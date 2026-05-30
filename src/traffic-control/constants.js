const PHASE_SEQUENCE = [
  { cursor: 0, phase: "NS_GREEN", durationSeconds: 25 },
  { cursor: 1, phase: "NS_YELLOW", durationSeconds: 4 },
  { cursor: 2, phase: "ALL_RED", durationSeconds: 2 },
  { cursor: 3, phase: "EW_GREEN", durationSeconds: 25 },
  { cursor: 4, phase: "EW_YELLOW", durationSeconds: 4 },
  { cursor: 5, phase: "ALL_RED", durationSeconds: 2 }
];

const PHASES_BY_CURSOR = new Map(PHASE_SEQUENCE.map((item) => [item.cursor, item.phase]));
const DURATIONS_BY_CURSOR = new Map(PHASE_SEQUENCE.map((item) => [item.cursor, item.durationSeconds]));

const CONTROL_ACTION_TYPES = [
  "TAKE_MANUAL_CONTROL",
  "ADVANCE_PHASE",
  "SET_ALL_RED",
  "RESUME_AUTO"
];

const INCIDENT_CATEGORIES = [
  "COLLISION",
  "VEHICLE_BREAKDOWN",
  "ROAD_BLOCK",
  "SIGNAL_FAULT",
  "WEATHER_HAZARD",
  "EMERGENCY_RESPONSE"
];

const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH"];
const INCIDENT_STATUSES = ["OPEN", "RESOLVED"];

const DEMO_OPERATOR = {
  actorId: "operator-demo",
  actorType: "OPERATOR",
  reportedBy: "operator-demo"
};

module.exports = {
  CONTROL_ACTION_TYPES,
  DEMO_OPERATOR,
  DURATIONS_BY_CURSOR,
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  PHASE_SEQUENCE,
  PHASES_BY_CURSOR
};