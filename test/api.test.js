const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { createServer } = require("../src/server");
const { createTrafficControlStore } = require("../src/traffic-control/service");

function createFixedClock(isoString = "2026-05-30T19:00:00.000Z") {
  const state = { value: new Date(isoString) };

  return {
    now() {
      return new Date(state.value);
    },
    set(isoValue) {
      state.value = new Date(isoValue);
    }
  };
}

async function withApi(testFn) {
  const clock = createFixedClock();
  const store = createTrafficControlStore({ clock });
  const server = createServer({ store });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  async function request(method, path, body) {
    const payload = body === undefined ? null : JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          method,
          path,
          headers: payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload)
              }
            : undefined
        },
        (res) => {
          let responseBody = "";
          res.on("data", (chunk) => {
            responseBody += chunk;
          });
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode,
              body: responseBody.length === 0 ? null : JSON.parse(responseBody)
            });
          });
        }
      );

      req.on("error", reject);
      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  try {
    await testFn({ request, clock });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("GET /api/v1/intersections returns 4 seeded intersections with derived actions", async () => {
  await withApi(async ({ request }) => {
    const response = await request("GET", "/api/v1/intersections");

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.items.length, 4);

    const riverMarket = response.body.items.find((item) => item.id === "intersection-river-market");
    assert.equal(riverMarket.controlMode, "MANUAL");
    assert.equal(riverMarket.signalState.phase, "ALL_RED");
    assert.deepEqual(riverMarket.availableActions, ["ADVANCE_PHASE"]);
    assert.equal(riverMarket.activeIncidentCount, 1);

    const stationOak = response.body.items.find((item) => item.id === "intersection-station-oak");
    assert.equal(stationOak.signalState.phase, "NS_YELLOW");
    assert.equal(typeof stationOak.signalState.cycleSecondsRemaining, "number");
  });
});

test("GET /api/v1/intersections/:id returns detail payload with incidents and events", async () => {
  await withApi(async ({ request }) => {
    const response = await request("GET", "/api/v1/intersections/intersection-river-market");

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.intersection.id, "intersection-river-market");
    assert.equal(response.body.activeIncidents.length, 1);
    assert.ok(response.body.recentEvents.length >= 2);
  });
});

test("unknown intersection ids return 404", async () => {
  await withApi(async ({ request }) => {
    const response = await request("GET", "/api/v1/intersections/does-not-exist");

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.error.code, "NOT_FOUND");
  });
});

test("POST /api/v1/intersections/:id/control-actions rejects blocked RESUME_AUTO with 409", async () => {
  await withApi(async ({ request }) => {
    const response = await request(
      "POST",
      "/api/v1/intersections/intersection-river-market/control-actions",
      {
        actionType: "RESUME_AUTO",
        reason: "Return to timer control after road clears"
      }
    );

    assert.equal(response.statusCode, 409);
    assert.equal(response.body.error.code, "INVALID_CONTROL_ACTION");
    assert.match(response.body.error.message, /RESUME_AUTO requires ALL_RED and no blocking open incident/);
    assert.deepEqual(response.body.allowedActions, ["ADVANCE_PHASE"]);
  });
});

test("POST /api/v1/intersections/:id/control-actions applies TAKE_MANUAL_CONTROL and appends an event", async () => {
  await withApi(async ({ request }) => {
    const response = await request(
      "POST",
      "/api/v1/intersections/intersection-central-1/control-actions",
      {
        actionType: "TAKE_MANUAL_CONTROL",
        reason: "Operator needs manual sequencing for stalled vehicle response"
      }
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.intersection.controlMode, "MANUAL");
    assert.deepEqual(response.body.intersection.availableActions, ["ADVANCE_PHASE", "SET_ALL_RED"]);
    assert.equal(response.body.event.eventType, "CONTROL_ACTION_APPLIED");
    assert.equal(response.body.event.details.actionType, "TAKE_MANUAL_CONTROL");
  });
});

test("POST /api/v1/incidents creates an open incident, updates the intersection, and appends an event", async () => {
  await withApi(async ({ request }) => {
    const response = await request("POST", "/api/v1/incidents", {
      intersectionId: "intersection-central-2",
      category: "VEHICLE_BREAKDOWN",
      severity: "MEDIUM",
      requiresManualControl: false,
      description: "Delivery truck stalled in the eastbound lane"
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.incident.status, "OPEN");
    assert.equal(response.body.intersection.id, "intersection-central-2");
    assert.equal(response.body.intersection.activeIncidentCount, 1);
    assert.equal(response.body.event.eventType, "INCIDENT_REPORTED");

    const listResponse = await request("GET", "/api/v1/incidents?status=OPEN&intersectionId=intersection-central-2");
    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.body.items.length, 1);
  });
});

test("validation errors return 422", async () => {
  await withApi(async ({ request }) => {
    const response = await request(
      "POST",
      "/api/v1/intersections/intersection-central-1/control-actions",
      {
        actionType: "TAKE_MANUAL_CONTROL",
        reason: "bad"
      }
    );

    assert.equal(response.statusCode, 422);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  });
});