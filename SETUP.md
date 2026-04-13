# AI Orchestrator — Setup Guide

## Quick Start

### 1. Copy these files into your repository

```
your-repo/
├── .github/
│   ├── workflows/
│   │   └── orchestrator.yml      ← Triggers the orchestrator
│   └── agents/
│       └── coordinator.agent.md  ← Coordinator agent instructions
├── .orchestrator/
│   └── config.yaml               ← Orchestrator configuration
```

### 2. Configure

Edit `.orchestrator/config.yaml`:

- Set `mode` to `advisory` (recommend only), `assisted` (create PRs, need human merge), or `autonomous` (full auto).
- Add your GitHub usernames to `human_developers`.
- Set `auto_merge: true` if you want auto-merging (default: false).

### 3. Roll out the pinned workflow image

This repository's `main` branch may still use `ghcr.io/purna88836/git-native-agentic-ai-orchestrator:latest` until the workflow change from issue #7 / PR #11 lands. The target workflow implementation replaces that mutable tag with a single immutable digest so every run is traceable to one published image build, image upgrades stay reviewable, and registry tag moves cannot change orchestrator behavior silently.

The rollout from #7 pins the image through a shared workflow variable:

```yaml
env:
  ORCHESTRATOR_IMAGE: ghcr.io/purna88836/git-native-agentic-ai-orchestrator@sha256:862e33b924c53110c1b06e406159423dda9ec646ae87f1463b1b9edd0cdbcb92
  REQUIRED_COPILOT_COMMAND: copilot
```

When you apply that change in `.github/workflows/orchestrator.yml`, keep the same `ORCHESTRATOR_IMAGE` value wired into all image-consuming steps:

1. `docker pull "$ORCHESTRATOR_IMAGE"` in `Pull orchestrator image`.
2. `docker run ... "$ORCHESTRATOR_IMAGE" ...` in `Preflight Copilot availability`.
3. The final `"$ORCHESTRATOR_IMAGE"` argument in `Run AI Orchestrator`.

#### Upgrading the pinned image

When maintainers intentionally move to a new orchestrator image:

1. Get the new published digest for `ghcr.io/purna88836/git-native-agentic-ai-orchestrator`.
2. Edit `env.ORCHESTRATOR_IMAGE` in `.github/workflows/orchestrator.yml` and replace the old digest with the new one.
3. In review, confirm `Pull orchestrator image`, `Preflight Copilot availability`, and `Run AI Orchestrator` all still reference `"$ORCHESTRATOR_IMAGE"`, and that `REQUIRED_COPILOT_COMMAND` remains `copilot` unless the container contract intentionally changes.
4. After the upgrade lands, verify the next workflow run logs `Preflighting pinned orchestrator image: ...` and then reaches the main orchestrator step with the expected digest.

#### Interpreting preflight tooling failures

Once the #7 workflow change is present, `Preflight Copilot availability` runs before the main orchestrator step and checks that the pinned image can resolve and invoke `copilot`.

Treat any failure there as an image-content problem, not an issue payload problem:

- `Pinned orchestrator image ... is missing required command: copilot` means the image does not contain the expected CLI.
- `Pinned orchestrator image ... could not invoke required command: copilot` means the command exists but did not run successfully.

When that happens, inspect `env.ORCHESTRATOR_IMAGE` in `.github/workflows/orchestrator.yml`, review the preflight step logs to see which diagnostic fired, compare the pinned digest with the image release notes or container contents, and reproduce locally with the same image before changing the workflow again.

### 4. Grant access (if private image)

If the Docker image is in a private GHCR package:

**Option A — Grant repo access to the package:**
1. Go to `github.com/orgs/YOUR-ORG/packages/container/git-native-agentic-ai-orchestrator/settings`
2. Under "Manage Actions access", add your repository

**Option B — Use a PAT:**
1. Create a PAT with `packages:read` scope
2. Add it as a repository secret `ORCHESTRATOR_PAT`
3. Add a login step before the action:
   ```yaml
   - name: Login to GHCR
     uses: docker/login-action@v3
     with:
       registry: ghcr.io
       username: ${{ github.actor }}
       password: ${{ secrets.ORCHESTRATOR_PAT }}
   ```

### 5. Create an issue

Open an issue in your repo. The orchestrator will:
- Detect the event
- Add `AI: working` label
- Post a workflow run link
- Analyze the issue
- Decompose, delegate, and track work

## How It Works

```
Issue created → Workflow triggers → Orchestrator runs →
  Copilot CLI loads .github/agents/coordinator.agent.md →
  Coordinator analyzes, decomposes, delegates →
  Actionable @orchestrator comments chain to next agents →
  Specialist agents create branches, PRs, reviews →
  Labels track state → Humans approve when needed
```

## Adding Specialist Agents

Add agent files to `.github/agents/`:

```markdown
---
name: my-specialist
description: What this specialist does
model: gpt-4o
tools:
  - orchestrator:*
  - github:*
  - read
  - edit
  - search
---

# My Specialist Agent

Instructions for this specialist...
```

The coordinator can also create agents dynamically when it encounters work that needs a missing specialist.

## Label Meanings

| Label | Meaning |
|---|---|
| `AI: working` | Orchestrator is actively working |
| `AI: human-approval` | Paused — waiting for human input |
| `AI: blocked` | Blocked on a technical issue |
| `AI: done` | Work complete |
