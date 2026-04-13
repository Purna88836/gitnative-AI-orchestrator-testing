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

Do not use a mutable tag such as `:latest` for the orchestrator container. Pinning the workflow to a single immutable image digest makes every workflow run traceable to an exact container build, keeps reviews focused on a deliberate image change, and avoids silent behavior changes when the registry tag moves.

Use one pinned reference format consistently anywhere the workflow pulls or runs the image:

```yaml
ghcr.io/purna88836/git-native-agentic-ai-orchestrator@sha256:<published-digest>
```

In `.github/workflows/orchestrator.yml`, update the image reference in both places so they stay identical:

1. The `docker pull ...` command in the `Pull orchestrator image` step.
2. The image argument at the end of the `docker run ...` command in the `Run AI Orchestrator` step.

#### Upgrading the pinned image

When maintainers intentionally move to a new orchestrator image:

1. Get the new published digest for `ghcr.io/purna88836/git-native-agentic-ai-orchestrator`.
2. Edit `.github/workflows/orchestrator.yml` and replace the existing digest in both the `docker pull` line and the final `docker run` image argument.
3. In review, confirm the pull and run references are still byte-for-byte identical and that the diff only changes the intended image version/digest.
4. After the upgrade lands, verify the next workflow run pulls the expected digest and that the preflight tooling check passes before the main orchestration step starts.

#### Interpreting preflight tooling failures

The workflow now performs a lightweight preflight check against the pinned image before the main orchestration step. If the image is missing required Copilot tooling, the workflow should fail fast and name both the pinned image reference and the missing command in the logs.

Treat that failure as an image-content problem, not an issue payload problem. Review the pinned digest in `.github/workflows/orchestrator.yml`, inspect the failing preflight step logs to see which command is missing, and compare the image you upgraded to with the expected container contents or release notes. If needed, reproduce locally with the same pinned image and inspect whether the required CLI is present before updating the workflow again.

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
