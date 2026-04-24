# Shared Memory

## Shared Learnings
- [2026-04-24] Approved Playwright MCP usage depends on the runner having Chrome available at /opt/google/chrome/chrome; without that binary, Playwright MCP browser launches fail before navigation even though the registry entry is present.
- [2026-04-21] Resumed orchestrator work may require clearing stale `AI: blocked` labels left behind by earlier human pause requests; don't assume a new actionable request cleaned labels automatically.
- [2026-04-17] Repo exploration for the Todo demo showed there is no pre-existing backend/frontend/test stack to extend. The safest default is an isolated, dependency-light demo workload rather than trying to infer a broader app architecture from the current repo.
