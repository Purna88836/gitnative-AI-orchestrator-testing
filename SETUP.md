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

### 3. Pin the workflow image

In `.github/workflows/orchestrator.yml`, define a single immutable image reference instead of a mutable tag such as `:latest`:

```yaml
env:
  ORCHESTRATOR_IMAGE: ghcr.io/purna88836/git-native-agentic-ai-orchestrator@sha256:862e33b924c53110c1b06e406159423dda9ec646ae87f1463b1b9edd0cdbcb92
```

Pinning the orchestrator image to a digest keeps every workflow run traceable to one published container build, makes upgrades reviewable, and prevents a registry tag move from silently changing orchestrator behavior.

Keep that same `ORCHESTRATOR_IMAGE` value wired into all image-consuming steps:

1. `Pull orchestrator image` runs `docker pull "$ORCHESTRATOR_IMAGE"`.
2. `Preflight Copilot CLI` runs `docker run --rm --entrypoint copilot "$ORCHESTRATOR_IMAGE" --version`.
3. `Run AI Orchestrator` uses the final `"$ORCHESTRATOR_IMAGE"` argument for the real orchestration run.

If your repository still references a mutable tag directly, migrate it to this shared env-based format before relying on the setup below.

#### Upgrading the pinned image

When maintainers intentionally upgrade the orchestrator image:

1. Get the new published digest for `ghcr.io/purna88836/git-native-agentic-ai-orchestrator`.
2. Update `jobs.orchestrate.env.ORCHESTRATOR_IMAGE` in `.github/workflows/orchestrator.yml`.
3. In review, confirm `Pull orchestrator image`, `Preflight Copilot CLI`, and `Run AI Orchestrator` still all use `"$ORCHESTRATOR_IMAGE"`, and that the preflight command is still `copilot --version`.
4. After the change lands, verify the next workflow run pulls and runs the expected digest.

#### Diagnosing preflight failures

`Preflight Copilot CLI` runs before `Run AI Orchestrator`. If it fails, treat that as a pinned-image problem rather than an issue-payload problem.

The workflow emits an error titled `Copilot CLI missing from pinned orchestrator image` and includes both the pinned image reference and the failed preflight command `copilot --version`.

When that happens:

1. Confirm `ORCHESTRATOR_IMAGE` points to the intended digest.
2. Read the `Preflight Copilot CLI` step output to capture the emitted diagnostic.
3. Compare that digest with the image release notes or container contents.
4. Reproduce locally with `docker run --rm --entrypoint copilot "$ORCHESTRATOR_IMAGE" --version` before changing the workflow again.

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
