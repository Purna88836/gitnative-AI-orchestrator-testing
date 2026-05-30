# gitnative-AI-orchestrator-testing

This repository now includes a minimal traffic-control operator API scaffold for the MVP contract defined in issue #54.

## Traffic-control API

The backend is a dependency-light Node service that exposes the approved REST + polling surface for:

- listing and inspecting 4 seeded intersections
- creating incidents
- applying constrained manual signal-control actions
- reading append-only event history

### Run

```bash
npm start
```

The server listens on `http://localhost:3000` by default.

### Test

```bash
npm test
```

### API base path

All operator endpoints live under `/api/v1`:

- `GET /api/v1/intersections`
- `GET /api/v1/intersections/:intersectionId`
- `POST /api/v1/intersections/:intersectionId/control-actions`
- `GET /api/v1/incidents`
- `POST /api/v1/incidents`
- `GET /api/v1/events`

The implementation matches the locked issue contract: exactly 4 seeded intersections, backend-derived `availableActions`, `409` for invalid control transitions, and event-history rows for accepted control actions and incident creation.