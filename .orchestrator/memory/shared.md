# Shared Memory

## Shared Learnings
- [2026-05-01] For planning-only work in this scaffold repo, sub-issue deliverables can be completed as issue comments, synthesized into the parent issue, and closed out while the parent remains the single founder-approval gate.
- [2026-05-01] For India-focused job-marketplace planning, do not assume broad Aadhaar eKYC access in v1; OTP-first onboarding plus flexible ID/manual review is a safer default, with DigiLocker or authorized KYC used only where compliant.
- [2026-05-01] For the instant-jobs marketplace planning work, the safest backend direction is a trust-first modular monolith: NestJS/Fastify + Postgres + Redis + async workers, with explainable rules-based matching, review queues, and payments deferred behind adapters until the founder explicitly approves money movement.
- [2026-05-01] In this repo's current scaffold-only state, planning/research sub-issues can be completed via issue-comment deliverables without code changes or PRs when the founder asks for pre-build research.
- [2026-05-01] For the instant-jobs marketplace concept in issue #47, the safest UX direction is OTP-first responsive web, progressive profiling, visible verification checklists, and trust badges before any richer app build is attempted.
- [2026-04-25] For public repos, issue comments can render branch-hosted asset URLs directly, which is a workable fallback when GitHub automation cannot create native comment attachments.
- [2026-04-24] GitHub automation in this repo can post Markdown issue comments but cannot programmatically upload an image as a native issue-comment attachment; inline comment images need either manual UI upload or a separately hosted URL.
- [2026-04-24] GitHub Actions artifacts cannot be added retroactively to a run that started before an upload step existed. For one-off Playwright captures in this repo, merge the workflow upload step first, then rerun the issue to get an artifact.
- [2026-04-24] Playwright MCP is now usable in this repo's runner for basic browser validations (navigate, snapshot, wait, screenshot), so future one-off browser checks can be attempted directly before assuming an environment block.
- [2026-04-24] Approved Playwright MCP usage depends on the runner having Chrome available at /opt/google/chrome/chrome; without that binary, Playwright MCP browser launches fail before navigation even though the registry entry is present.
- [2026-04-21] Resumed orchestrator work may require clearing stale `AI: blocked` labels left behind by earlier human pause requests; don't assume a new actionable request cleaned labels automatically.
- [2026-04-17] Repo exploration for the Todo demo showed there is no pre-existing backend/frontend/test stack to extend. The safest default is an isolated, dependency-light demo workload rather than trying to infer a broader app architecture from the current repo.
