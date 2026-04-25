# Coordinator Agent Memory

## Architectural
- [2026-04-25] For public repos, a branch-hosted file URL can be embedded in an issue comment as a workaround when native comment attachments are unavailable; safe branches can hold transient issue assets.
- [2026-04-24] GitHub issue comments can only embed images by URL through the available automation surface; direct binary comment-attachment upload is not exposed through the public API/MCP tools.
- [2026-04-24] The current runner environment can now execute the approved Playwright MCP browser flow successfully for simple navigation/snapshot/screenshot validations; issue #45 completed against https://example.com after the browser libraries were installed.
- [2026-04-24] The repo's approved MCP registry already includes a low-risk Playwright server for headless browser automation, so simple browser-validation issues do not need a new specialist agent by default.
- [2026-04-17] This repository is currently a thin orchestrator scaffold: docs, orchestrator config, one orchestrator workflow, and specialist agent files, but no existing application/runtime stack. New demo workloads should be isolated under their own directory and keep dependencies minimal unless a concrete need emerges.

## Mistakes
- [2026-04-24] The approved Playwright MCP server can still fail on the runner if Chrome is not present at /opt/google/chrome/chrome; browser automation issues may need a runner-image check before execution.
- [2026-04-21] A human 'pause work' comment can leave an issue carrying a stale `AI: blocked` label even after new human instructions resume work, so resumed issues may need explicit label cleanup before posting status.
- [2026-04-17] The active work board can include closed issues that still retain the `AI: working` label, so board reads may need human interpretation or cleanup before using them for workload decisions.

## Decisions
- [2026-04-24] For Playwright artifact publication, the minimal fix is an additive upload-artifact step in `.github/workflows/orchestrator.yml`; issue-triggered runs only publish artifacts after that workflow change is merged and the issue is rerun.
- [2026-04-18] For the Todo demo rollout, QA validation landed as stacked PR #44 on top of backend PR #43 because main did not yet contain the demo. The clean merge order is PR #41 (docs) -> PR #42 (frontend) -> PR #43 (backend) -> retarget/refresh PR #44 onto main -> merge PR #44.
