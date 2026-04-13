# gitnative-AI-orchestrator-testing

AI orchestrator demo/scaffold for running issue-driven GitHub automation with a coordinator agent, specialist agents, workflow triggers, PR handoffs, and status labels.

## Start here

**See [SETUP.md](./SETUP.md) for installation, configuration, and workflow details.**

## What this repository contains

- **`.github/`** — GitHub Actions workflow definitions plus agent instruction files used by the orchestrator.
- **`.orchestrator/`** — repository-level orchestrator configuration such as operating mode, label names, and automation behavior.

## Supported operating modes

- **`advisory`** — recommends actions without taking full execution steps.
- **`assisted`** — opens branches/PRs and prepares work for human review and merge.
- **`autonomous`** — allows the highest level of end-to-end automation.

## Label meanings

- **`AI: working`** — the orchestrator is actively processing the task.
- **`AI: human-approval`** — automation is paused pending human input.
- **`AI: blocked`** — progress is blocked by a technical or workflow issue.
- **`AI: done`** — the scoped work is complete.

## Quick start for a fresh repository

1. Copy the scaffold files into your repository, especially `.github/` and `.orchestrator/`.
2. Edit `.orchestrator/config.yaml` to choose `advisory`, `assisted`, or `autonomous`, and add your `human_developers`.
3. Update `.github/workflows/orchestrator.yml` so it points at your orchestrator image and has any required package access.
4. Open an issue in the repo to trigger the workflow and let the orchestrator begin work.

For the full setup flow, configuration notes, and operating model, use **[SETUP.md](./SETUP.md)**.
