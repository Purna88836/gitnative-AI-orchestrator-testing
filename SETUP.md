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

### 3. Update the workflow

In `.github/workflows/orchestrator.yml`, replace `YOUR-ORG` with the actual organization name:

```yaml
uses: docker://ghcr.io/YOUR-ORG/ai-orchestrator:latest
```

### 4. Grant access (if private image)

If the Docker image is in a private GHCR package:

**Option A — Grant repo access to the package:**
1. Go to `github.com/orgs/YOUR-ORG/packages/container/ai-orchestrator/settings`
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
