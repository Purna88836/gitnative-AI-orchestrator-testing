# Shared Memory

## Shared Learnings
- [2026-04-25] For public repos, issue comments can render branch-hosted asset URLs directly, which is a workable fallback when GitHub automation cannot create native comment attachments.
- [2026-04-24] GitHub automation in this repo can post Markdown issue comments but cannot programmatically upload an image as a native issue-comment attachment; inline comment images need either manual UI upload or a separately hosted URL.
- [2026-04-24] GitHub Actions artifacts cannot be added retroactively to a run that started before an upload step existed. For one-off Playwright captures in this repo, merge the workflow upload step first, then rerun the issue to get an artifact.
- [2026-04-24] Playwright MCP is now usable in this repo's runner for basic browser validations (navigate, snapshot, wait, screenshot), so future one-off browser checks can be attempted directly before assuming an environment block.
- [2026-04-24] Approved Playwright MCP usage depends on the runner having Chrome available at /opt/google/chrome/chrome; without that binary, Playwright MCP browser launches fail before navigation even though the registry entry is present.
- [2026-04-21] Resumed orchestrator work may require clearing stale `AI: blocked` labels left behind by earlier human pause requests; don't assume a new actionable request cleaned labels automatically.
- [2026-04-17] Repo exploration for the Todo demo showed there is no pre-existing backend/frontend/test stack to extend. The safest default is an isolated, dependency-light demo workload rather than trying to infer a broader app architecture from the current repo.
