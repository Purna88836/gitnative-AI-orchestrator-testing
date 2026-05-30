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
- [2026-05-30] For issue #52, once #54 locked the contract only as an issue-comment deliverable and `main` was still scaffold-only, the safest next step was to dispatch #57 first and keep #58 queued until backend establishes the initial app/API surface.
- [2026-05-30] For issue #52, once the founder approved the simulation-first MVP scope, the correct next orchestration step was to dispatch #54 first and hold #57/#58 until the contract and state-transition rules are locked.
- [2026-05-30] For issue #52, the road-traffic-control app should start as a simulation-first operator MVP: 3-5 modeled intersections, manual control actions, incident logging, and audit history, with live hardware integration and optimization deferred until after founder approval.
- [2026-05-01] For founder-facing progress-report issues in this scaffold repo, summarize progress by milestone and explicitly separate work merged to main from work that is only issue-done or sitting in open PRs.
- [2026-05-01] For planning-only parent issues in this scaffold repo, once sub-issue research is synthesized into the parent issue comment and the parent carries the human-approval gate, the child research issue can be marked done without opening a PR.
- [2026-04-24] For Playwright artifact publication, the minimal fix is an additive upload-artifact step in `.github/workflows/orchestrator.yml`; issue-triggered runs only publish artifacts after that workflow change is merged and the issue is rerun.
- [2026-04-18] For the Todo demo rollout, QA validation landed as stacked PR #44 on top of backend PR #43 because main did not yet contain the demo. The clean merge order is PR #41 (docs) -> PR #42 (frontend) -> PR #43 (backend) -> retarget/refresh PR #44 onto main -> merge PR #44.
