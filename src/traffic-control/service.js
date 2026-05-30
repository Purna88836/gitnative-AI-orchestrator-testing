const {
  CONTROL_ACTION_TYPES,
  DEMO_OPERATOR,
  DURATIONS_BY_CURSOR,
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  PHASE_SEQUENCE,
  PHASES_BY_CURSOR
} = require("./constants");

class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toIsoString(value) {
  return new Date(value).toISOString();
}

function phaseForCursor(cursor) {
  return PHASES_BY_CURSOR.get(cursor);
}

function durationForCursor(cursor) {
  return DURATIONS_BY_CURSOR.get(cursor);
}

function formatEnumLabel(value) {
  return value.split("_").join(" ");
}

function nextAllRedCursor(cursor) {
  if (cursor < 2) {
    return 2;
  }

  if (cursor < 5) {
    return 5;
  }

  return 2;
}

function compareDescendingDates(left, right) {
  return new Date(right).getTime() - new Date(left).getTime();
}

function buildIntersectionView(record, openIncidents, state) {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    corridor: record.corridor,
    displayOrder: record.displayOrder,
    gridPosition: clone(record.gridPosition),
    controlMode: record.controlMode,
    operationalStatus: openIncidents.length > 0 ? "INCIDENT_ACTIVE" : "NORMAL",
    signalState: {
      phase: state.phase,
      phaseSequenceCursor: state.cursor,
      cycleSecondsRemaining: record.controlMode === "AUTO" ? state.cycleSecondsRemaining : null,
      updatedAt: state.updatedAt
    },
    activeIncidentCount: openIncidents.length,
    availableActions: deriveAvailableActions(record.controlMode, state.phase, openIncidents),
    lastControlActionAt: record.lastControlActionAt,
    lastEventAt: record.lastEventAt
  };
}

function deriveAvailableActions(controlMode, phase, openIncidents) {
  if (controlMode === "AUTO") {
    return ["TAKE_MANUAL_CONTROL"];
  }

  const actions = ["ADVANCE_PHASE"];
  if (phase !== "ALL_RED") {
    actions.push("SET_ALL_RED");
    return actions;
  }

  const hasBlockingIncident = openIncidents.some((incident) => incident.requiresManualControl);
  if (!hasBlockingIncident) {
    actions.push("RESUME_AUTO");
  }

  return actions;
}

function validateControlActionRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(422, "VALIDATION_ERROR", "Control action payload must be a JSON object");
  }

  const { actionType, reason } = payload;
  if (!CONTROL_ACTION_TYPES.includes(actionType)) {
    throw new HttpError(422, "VALIDATION_ERROR", "actionType must be one of the approved control actions");
  }

  if (typeof reason !== "string") {
    throw new HttpError(422, "VALIDATION_ERROR", "reason is required");
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 5 || trimmedReason.length > 240) {
    throw new HttpError(422, "VALIDATION_ERROR", "reason must be between 5 and 240 characters");
  }

  return {
    actionType,
    reason: trimmedReason
  };
}

function validateIncidentRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(422, "VALIDATION_ERROR", "Incident payload must be a JSON object");
  }

  const {
    intersectionId,
    category,
    severity,
    requiresManualControl,
    description
  } = payload;

  if (typeof intersectionId !== "string" || intersectionId.trim().length === 0) {
    throw new HttpError(422, "VALIDATION_ERROR", "intersectionId is required");
  }

  if (!INCIDENT_CATEGORIES.includes(category)) {
    throw new HttpError(422, "VALIDATION_ERROR", "category must be a supported incident category");
  }

  if (!INCIDENT_SEVERITIES.includes(severity)) {
    throw new HttpError(422, "VALIDATION_ERROR", "severity must be LOW, MEDIUM, or HIGH");
  }

  if (typeof requiresManualControl !== "boolean") {
    throw new HttpError(422, "VALIDATION_ERROR", "requiresManualControl must be a boolean");
  }

  if (typeof description !== "string") {
    throw new HttpError(422, "VALIDATION_ERROR", "description is required");
  }

  const trimmedDescription = description.trim();
  if (trimmedDescription.length < 10 || trimmedDescription.length > 500) {
    throw new HttpError(422, "VALIDATION_ERROR", "description must be between 10 and 500 characters");
  }

  return {
    intersectionId: intersectionId.trim(),
    category,
    severity,
    requiresManualControl,
    description: trimmedDescription
  };
}

function validateIncidentListFilters(filters) {
  const normalized = {};

  if (filters.status !== undefined) {
    if (!INCIDENT_STATUSES.includes(filters.status)) {
      throw new HttpError(422, "VALIDATION_ERROR", "status must be OPEN or RESOLVED");
    }
    normalized.status = filters.status;
  }

  if (filters.intersectionId !== undefined) {
    if (typeof filters.intersectionId !== "string" || filters.intersectionId.trim().length === 0) {
      throw new HttpError(422, "VALIDATION_ERROR", "intersectionId must be a non-empty string");
    }
    normalized.intersectionId = filters.intersectionId.trim();
  }

  return normalized;
}

function validateEventFilters(filters) {
  const normalized = {};

  if (filters.intersectionId !== undefined) {
    if (typeof filters.intersectionId !== "string" || filters.intersectionId.trim().length === 0) {
      throw new HttpError(422, "VALIDATION_ERROR", "intersectionId must be a non-empty string");
    }
    normalized.intersectionId = filters.intersectionId.trim();
  }

  const limit = filters.limit === undefined ? 20 : Number.parseInt(filters.limit, 10);
  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
    throw new HttpError(422, "VALIDATION_ERROR", "limit must be an integer between 1 and 100");
  }
  normalized.limit = limit;

  return normalized;
}

class TrafficControlStore {
  constructor({ clock = { now: () => new Date() } } = {}) {
    this.clock = clock;
    this.intersections = new Map();
    this.incidents = new Map();
    this.events = [];
    this.nextIncidentNumber = 3;
    this.nextEventNumber = 8;
    this.seed();
  }

  seed() {
    const now = this.clock.now();
    const nowMs = now.getTime();
    const minutes = 60 * 1000;
    const seconds = 1000;

    const intersectionRecords = [
      {
        id: "intersection-central-1",
        code: "INT-101",
        name: "Central Ave & 1st St",
        corridor: "Central Corridor",
        displayOrder: 1,
        gridPosition: { row: 1, column: 1 },
        controlMode: "AUTO",
        phaseSequenceCursor: 0,
        autoPhaseAnchorAt: toIsoString(nowMs - (6 * seconds)),
        phaseUpdatedAt: toIsoString(nowMs - (6 * seconds)),
        lastControlActionAt: toIsoString(nowMs - (18 * minutes)),
        lastEventAt: toIsoString(nowMs - (18 * minutes))
      },
      {
        id: "intersection-central-2",
        code: "INT-102",
        name: "Central Ave & 4th St",
        corridor: "Central Corridor",
        displayOrder: 2,
        gridPosition: { row: 1, column: 2 },
        controlMode: "AUTO",
        phaseSequenceCursor: 3,
        autoPhaseAnchorAt: toIsoString(nowMs - (11 * seconds)),
        phaseUpdatedAt: toIsoString(nowMs - (11 * seconds)),
        lastControlActionAt: toIsoString(nowMs - (30 * minutes)),
        lastEventAt: toIsoString(nowMs - (2 * minutes))
      },
      {
        id: "intersection-river-market",
        code: "INT-201",
        name: "River Market & Dock Rd",
        corridor: "Market District",
        displayOrder: 3,
        gridPosition: { row: 2, column: 1 },
        controlMode: "MANUAL",
        phaseSequenceCursor: 2,
        autoPhaseAnchorAt: null,
        phaseUpdatedAt: toIsoString(nowMs - (9 * minutes)),
        lastControlActionAt: toIsoString(nowMs - (9 * minutes)),
        lastEventAt: toIsoString(nowMs - (8 * minutes))
      },
      {
        id: "intersection-station-oak",
        code: "INT-301",
        name: "Station Blvd & Oak St",
        corridor: "Station District",
        displayOrder: 4,
        gridPosition: { row: 2, column: 2 },
        controlMode: "AUTO",
        phaseSequenceCursor: 1,
        autoPhaseAnchorAt: toIsoString(nowMs - (2 * seconds)),
        phaseUpdatedAt: toIsoString(nowMs - (2 * seconds)),
        lastControlActionAt: null,
        lastEventAt: toIsoString(nowMs - (72 * minutes))
      }
    ];

    for (const intersection of intersectionRecords) {
      this.intersections.set(intersection.id, intersection);
    }

    const incidents = [
      {
        id: "incident-1",
        intersectionId: "intersection-river-market",
        category: "ROAD_BLOCK",
        severity: "HIGH",
        status: "OPEN",
        requiresManualControl: true,
        description: "Crash debris is blocking the eastbound through lane",
        reportedBy: DEMO_OPERATOR.reportedBy,
        reportedAt: toIsoString(nowMs - (8 * minutes)),
        resolvedAt: null
      },
      {
        id: "incident-2",
        intersectionId: "intersection-station-oak",
        category: "SIGNAL_FAULT",
        severity: "MEDIUM",
        status: "RESOLVED",
        requiresManualControl: false,
        description: "Detector reset completed after a brief yellow timing fault",
        reportedBy: DEMO_OPERATOR.reportedBy,
        reportedAt: toIsoString(nowMs - (80 * minutes)),
        resolvedAt: toIsoString(nowMs - (72 * minutes))
      }
    ];

    for (const incident of incidents) {
      this.incidents.set(incident.id, incident);
    }

    this.events = [
      {
        id: "event-1",
        intersectionId: "intersection-station-oak",
        eventType: "INCIDENT_REPORTED",
        actorType: DEMO_OPERATOR.actorType,
        actorId: DEMO_OPERATOR.actorId,
        summary: "Signal fault reported at Station Blvd & Oak St",
        details: {
          incidentId: "incident-2",
          category: "SIGNAL_FAULT",
          severity: "MEDIUM"
        },
        createdAt: toIsoString(nowMs - (80 * minutes))
      },
      {
        id: "event-2",
        intersectionId: "intersection-station-oak",
        eventType: "INCIDENT_RESOLVED",
        actorType: DEMO_OPERATOR.actorType,
        actorId: DEMO_OPERATOR.actorId,
        summary: "Signal fault resolved at Station Blvd & Oak St",
        details: {
          incidentId: "incident-2"
        },
        createdAt: toIsoString(nowMs - (72 * minutes))
      },
      {
        id: "event-3",
        intersectionId: "intersection-central-2",
        eventType: "CONTROL_ACTION_APPLIED",
        actorType: DEMO_OPERATOR.actorType,
        actorId: DEMO_OPERATOR.actorId,
        summary: "Central Ave & 4th St resumed AUTO control",
        details: {
          actionType: "RESUME_AUTO",
          reason: "Prior manual test run finished"
        },
        createdAt: toIsoString(nowMs - (30 * minutes))
      },
      {
        id: "event-4",
        intersectionId: "intersection-central-1",
        eventType: "CONTROL_ACTION_APPLIED",
        actorType: DEMO_OPERATOR.actorType,
        actorId: DEMO_OPERATOR.actorId,
        summary: "Central Ave & 1st St resumed AUTO control",
        details: {
          actionType: "RESUME_AUTO",
          reason: "Morning rush fallback cleared"
        },
        createdAt: toIsoString(nowMs - (18 * minutes))
      },
      {
        id: "event-5",
        intersectionId: "intersection-river-market",
        eventType: "CONTROL_ACTION_APPLIED",
        actorType: DEMO_OPERATOR.actorType,
        actorId: DEMO_OPERATOR.actorId,
        summary: "River Market & Dock Rd switched to MANUAL control",
        details: {
          actionType: "TAKE_MANUAL_CONTROL",
          reason: "Manual hold while crews clear debris"
        },
        createdAt: toIsoString(nowMs - (9 * minutes))
      },
      {
        id: "event-6",
        intersectionId: "intersection-river-market",
        eventType: "INCIDENT_REPORTED",
        actorType: DEMO_OPERATOR.actorType,
        actorId: DEMO_OPERATOR.actorId,
        summary: "Road block reported at River Market & Dock Rd",
        details: {
          incidentId: "incident-1",
          category: "ROAD_BLOCK",
          severity: "HIGH"
        },
        createdAt: toIsoString(nowMs - (8 * minutes))
      },
      {
        id: "event-7",
        intersectionId: "intersection-central-2",
        eventType: "CONTROL_ACTION_APPLIED",
        actorType: "SYSTEM",
        actorId: "system-simulator",
        summary: "Simulation timing anchor refreshed for Central Ave & 4th St",
        details: {
          phase: "EW_GREEN"
        },
        createdAt: toIsoString(nowMs - (2 * minutes))
      }
    ];
  }

  synchronizeIntersection(record, now = this.clock.now()) {
    if (record.controlMode !== "AUTO" || !record.autoPhaseAnchorAt) {
      return {
        cursor: record.phaseSequenceCursor,
        phase: phaseForCursor(record.phaseSequenceCursor),
        cycleSecondsRemaining: null,
        updatedAt: record.phaseUpdatedAt
      };
    }

    const anchorMs = new Date(record.autoPhaseAnchorAt).getTime();
    let elapsedSeconds = Math.max(0, Math.floor((now.getTime() - anchorMs) / 1000));
    let cursor = record.phaseSequenceCursor;
    let phaseStartMs = anchorMs;

    while (elapsedSeconds >= durationForCursor(cursor)) {
      elapsedSeconds -= durationForCursor(cursor);
      phaseStartMs += durationForCursor(cursor) * 1000;
      cursor = (cursor + 1) % PHASE_SEQUENCE.length;
    }

    return {
      cursor,
      phase: phaseForCursor(cursor),
      cycleSecondsRemaining: durationForCursor(cursor) - elapsedSeconds,
      updatedAt: toIsoString(phaseStartMs)
    };
  }

  getIntersectionRecord(intersectionId) {
    const intersection = this.intersections.get(intersectionId);
    if (!intersection) {
      throw new HttpError(404, "NOT_FOUND", `Unknown intersection: ${intersectionId}`);
    }

    return intersection;
  }

  getIncidentRecord(incidentId) {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new HttpError(404, "NOT_FOUND", `Unknown incident: ${incidentId}`);
    }

    return incident;
  }

  listOpenIncidentsByIntersection(intersectionId) {
    return Array.from(this.incidents.values())
      .filter((incident) => incident.intersectionId === intersectionId && incident.status === "OPEN")
      .sort((left, right) => compareDescendingDates(left.reportedAt, right.reportedAt));
  }

  materializeIntersection(intersectionId, now = this.clock.now()) {
    const intersection = this.getIntersectionRecord(intersectionId);
    const openIncidents = this.listOpenIncidentsByIntersection(intersectionId);
    const state = this.synchronizeIntersection(intersection, now);
    return buildIntersectionView(intersection, openIncidents, state);
  }

  listIntersections(now = this.clock.now()) {
    return Array.from(this.intersections.values())
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((intersection) => this.materializeIntersection(intersection.id, now));
  }

  listIncidents(filters = {}) {
    const normalizedFilters = validateIncidentListFilters(filters);

    if (normalizedFilters.intersectionId) {
      this.getIntersectionRecord(normalizedFilters.intersectionId);
    }

    return Array.from(this.incidents.values())
      .filter((incident) => {
        if (normalizedFilters.intersectionId && incident.intersectionId !== normalizedFilters.intersectionId) {
          return false;
        }

        if (normalizedFilters.status && incident.status !== normalizedFilters.status) {
          return false;
        }

        return true;
      })
      .sort((left, right) => compareDescendingDates(left.reportedAt, right.reportedAt))
      .map((incident) => clone(incident));
  }

  listEvents(filters = {}) {
    const normalizedFilters = validateEventFilters(filters);

    if (normalizedFilters.intersectionId) {
      this.getIntersectionRecord(normalizedFilters.intersectionId);
    }

    return this.events
      .filter((event) => {
        if (normalizedFilters.intersectionId && event.intersectionId !== normalizedFilters.intersectionId) {
          return false;
        }

        return true;
      })
      .sort((left, right) => compareDescendingDates(left.createdAt, right.createdAt))
      .slice(0, normalizedFilters.limit)
      .map((event) => clone(event));
  }

  getIntersectionDetail(intersectionId, now = this.clock.now()) {
    const intersection = this.materializeIntersection(intersectionId, now);
    const activeIncidents = this.listOpenIncidentsByIntersection(intersectionId).map((incident) => clone(incident));
    const recentEvents = this.listEvents({ intersectionId, limit: 20 });

    return {
      intersection,
      activeIncidents,
      recentEvents
    };
  }

  appendEvent(event) {
    this.events.push(event);
    const intersection = this.getIntersectionRecord(event.intersectionId);
    intersection.lastEventAt = event.createdAt;
    return clone(event);
  }

  createIncident(payload, now = this.clock.now()) {
    const validated = validateIncidentRequest(payload);
    this.getIntersectionRecord(validated.intersectionId);

    const incident = {
      id: `incident-${this.nextIncidentNumber}`,
      intersectionId: validated.intersectionId,
      category: validated.category,
      severity: validated.severity,
      status: "OPEN",
      requiresManualControl: validated.requiresManualControl,
      description: validated.description,
      reportedBy: DEMO_OPERATOR.reportedBy,
      reportedAt: now.toISOString(),
      resolvedAt: null
    };
    this.nextIncidentNumber += 1;
    this.incidents.set(incident.id, incident);

    const event = this.appendEvent({
      id: `event-${this.nextEventNumber}`,
      intersectionId: incident.intersectionId,
      eventType: "INCIDENT_REPORTED",
      actorType: DEMO_OPERATOR.actorType,
      actorId: DEMO_OPERATOR.actorId,
      summary: `${formatEnumLabel(validated.category)} reported at ${this.getIntersectionRecord(incident.intersectionId).name}`,
      details: {
        incidentId: incident.id,
        category: incident.category,
        severity: incident.severity,
        requiresManualControl: incident.requiresManualControl
      },
      createdAt: now.toISOString()
    });
    this.nextEventNumber += 1;

    return {
      incident: clone(incident),
      intersection: this.materializeIntersection(incident.intersectionId, now),
      event
    };
  }

  applyControlAction(intersectionId, payload, now = this.clock.now()) {
    const validated = validateControlActionRequest(payload);
    const intersection = this.getIntersectionRecord(intersectionId);
    const openIncidents = this.listOpenIncidentsByIntersection(intersectionId);
    const state = this.synchronizeIntersection(intersection, now);
    const availableActions = deriveAvailableActions(intersection.controlMode, state.phase, openIncidents);

    if (!availableActions.includes(validated.actionType)) {
      throw new HttpError(
        409,
        "INVALID_CONTROL_ACTION",
        this.buildInvalidControlMessage(validated.actionType, intersection.controlMode, state.phase, openIncidents),
        { allowedActions: availableActions }
      );
    }

    if (validated.actionType === "TAKE_MANUAL_CONTROL") {
      intersection.controlMode = "MANUAL";
      intersection.phaseSequenceCursor = state.cursor;
      intersection.autoPhaseAnchorAt = null;
      intersection.phaseUpdatedAt = state.updatedAt;
    } else if (validated.actionType === "ADVANCE_PHASE") {
      intersection.phaseSequenceCursor = (state.cursor + 1) % PHASE_SEQUENCE.length;
      intersection.phaseUpdatedAt = now.toISOString();
    } else if (validated.actionType === "SET_ALL_RED") {
      intersection.phaseSequenceCursor = nextAllRedCursor(state.cursor);
      intersection.phaseUpdatedAt = now.toISOString();
    } else if (validated.actionType === "RESUME_AUTO") {
      intersection.controlMode = "AUTO";
      intersection.phaseSequenceCursor = state.cursor;
      intersection.autoPhaseAnchorAt = now.toISOString();
      intersection.phaseUpdatedAt = now.toISOString();
    }

    intersection.lastControlActionAt = now.toISOString();

    const event = this.appendEvent({
      id: `event-${this.nextEventNumber}`,
      intersectionId,
      eventType: "CONTROL_ACTION_APPLIED",
      actorType: DEMO_OPERATOR.actorType,
      actorId: DEMO_OPERATOR.actorId,
      summary: `${this.getIntersectionRecord(intersectionId).name} applied ${validated.actionType}`,
      details: {
        actionType: validated.actionType,
        reason: validated.reason,
        resultingControlMode: intersection.controlMode,
        resultingPhase: phaseForCursor(intersection.phaseSequenceCursor)
      },
      createdAt: now.toISOString()
    });
    this.nextEventNumber += 1;

    return {
      intersection: this.materializeIntersection(intersectionId, now),
      event
    };
  }

  buildInvalidControlMessage(actionType, controlMode, phase, openIncidents) {
    if (actionType === "TAKE_MANUAL_CONTROL" && controlMode === "MANUAL") {
      return "TAKE_MANUAL_CONTROL is only valid while the intersection is in AUTO";
    }

    if (actionType === "SET_ALL_RED" && phase === "ALL_RED") {
      return "SET_ALL_RED is not valid when the current phase is already ALL_RED";
    }

    if (actionType === "RESUME_AUTO") {
      if (phase !== "ALL_RED") {
        return "RESUME_AUTO requires ALL_RED and no blocking open incident";
      }

      if (openIncidents.some((incident) => incident.requiresManualControl)) {
        return "RESUME_AUTO requires ALL_RED and no blocking open incident";
      }
    }

    if (controlMode === "AUTO") {
      return `${actionType} is only valid while the intersection is in MANUAL`;
    }

    return `${actionType} is not allowed in the current intersection state`;
  }
}

function createTrafficControlStore(options) {
  return new TrafficControlStore(options);
}

module.exports = {
  HttpError,
  createTrafficControlStore
};