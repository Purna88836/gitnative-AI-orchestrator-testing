const http = require("http");
const { createTrafficControlStore, HttpError } = require("./traffic-control/service");

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        reject(new HttpError(422, "VALIDATION_ERROR", "Request body must be 1MB or smaller"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (body.trim().length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new HttpError(422, "VALIDATION_ERROR", "Request body must be valid JSON"));
      }
    });

    request.on("error", reject);
  });
}

function notFound(message = "Route not found") {
  return new HttpError(404, "NOT_FOUND", message);
}

function createHandler({ store }) {
  return async function handler(request, response) {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const segments = url.pathname.split("/").filter(Boolean);

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, { status: "ok" });
        return;
      }

      if (segments[0] !== "api" || segments[1] !== "v1") {
        throw notFound();
      }

      if (request.method === "GET" && segments.length === 3 && segments[2] === "intersections") {
        sendJson(response, 200, { items: store.listIntersections() });
        return;
      }

      if (request.method === "GET" && segments.length === 4 && segments[2] === "intersections") {
        sendJson(response, 200, store.getIntersectionDetail(segments[3]));
        return;
      }

      if (
        request.method === "POST" &&
        segments.length === 5 &&
        segments[2] === "intersections" &&
        segments[4] === "control-actions"
      ) {
        const payload = await readJsonBody(request);
        sendJson(response, 200, store.applyControlAction(segments[3], payload));
        return;
      }

      if (request.method === "GET" && segments.length === 3 && segments[2] === "incidents") {
        sendJson(response, 200, {
          items: store.listIncidents({
            status: url.searchParams.get("status") || undefined,
            intersectionId: url.searchParams.get("intersectionId") || undefined
          })
        });
        return;
      }

      if (request.method === "POST" && segments.length === 3 && segments[2] === "incidents") {
        const payload = await readJsonBody(request);
        sendJson(response, 201, store.createIncident(payload));
        return;
      }

      if (request.method === "GET" && segments.length === 3 && segments[2] === "events") {
        sendJson(response, 200, {
          items: store.listEvents({
            intersectionId: url.searchParams.get("intersectionId") || undefined,
            limit: url.searchParams.get("limit") || undefined
          })
        });
        return;
      }

      throw notFound();
    } catch (error) {
      if (error instanceof HttpError) {
        const body = {
          error: {
            code: error.code,
            message: error.message
          }
        };

        if (error.extra.allowedActions) {
          body.allowedActions = error.extra.allowedActions;
        }

        sendJson(response, error.status, body);
        return;
      }

      console.error("traffic-control-api request failed", {
        method: request.method,
        url: request.url,
        message: error instanceof Error ? error.message : String(error)
      });

      sendJson(response, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error"
        }
      });
    }
  };
}

function createServer({ store = createTrafficControlStore() } = {}) {
  return http.createServer(createHandler({ store }));
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const server = createServer();
  server.listen(port, () => {
    console.log(`traffic-control-api listening on http://localhost:${port}`);
  });
}

module.exports = {
  createServer
};