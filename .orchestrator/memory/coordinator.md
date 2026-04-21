# Coordinator Agent Memory

## Architectural
- [2026-04-17] This repository is currently a thin orchestrator scaffold: docs, orchestrator config, one orchestrator workflow, and specialist agent files, but no existing application/runtime stack. New demo workloads should be isolated under their own directory and keep dependencies minimal unless a concrete need emerges.

## Mistakes
- [2026-04-21] A human 'pause work' comment can leave an issue carrying a stale `AI: blocked` label even after new human instructions resume work, so resumed issues may need explicit label cleanup before posting status.
- [2026-04-17] The active work board can include closed issues that still retain the `AI: working` label, so board reads may need human interpretation or cleanup before using them for workload decisions.

## Decisions
- [2026-04-18] For the Todo demo rollout, QA validation landed as stacked PR #44 on top of backend PR #43 because main did not yet contain the demo. The clean merge order is PR #41 (docs) -> PR #42 (frontend) -> PR #43 (backend) -> retarget/refresh PR #44 onto main -> merge PR #44.
