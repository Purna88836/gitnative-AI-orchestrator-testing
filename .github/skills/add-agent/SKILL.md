---
name: add-agent
description: How to create a new specialist agent that doesn't exist yet, including MCP server dependencies and secrets.
audience: [coordinator]
triggers:
  - "no agent can handle this task"
  - "create a new specialist"
  - "missing agent"
  - "need a new agent for X"
---

# Add Agent Skill

Use this skill when no existing agent in `.github/agents/` can handle a task
and a new specialist is needed. Creating an agent is **always a human-approved
event** — the agent is born via a PR the human must merge.

## When to use

- You analyzed the issue and matched tasks against existing agents.
- No current agent's description and tools match the required expertise.
- Before falling back to this, confirm you truly need a new specialist
  (not just a new task for an existing one).

## Steps

### 1. Confirm no existing agent fits

Re-read the output of `list_repository_files(".github/agents/")` and the
description of each agent. If any existing agent's description overlaps
>60% with the task, delegate to it instead.

### 2. Decide the agent's scope (narrow is better)

Name the agent by **role**, not by tool (`backend`, `devops`, `qa` — not
`poetry-user` or `aws-cli-wrapper`). Describe its expertise in one
sentence: "implements server-side APIs and database logic."

### 3. Pick the minimum set of MCP tools

Call `list_available_tools` to see the orchestrator's built-in tools.
Pick only the ones this role needs. Always include the baseline every
agent needs: `get_issue`, `list_issue_comments`, `create_issue_comment`,
`create_actionable_comment`, `create_info_comment`,
`create_safe_work_branch`, `write_file_on_branch`, `create_pull_request`,
`ensure_labels_exist`, `mark_issue_working`, `mark_issue_done`,
`request_human_approval`, `store_memory`, `get_agent_memory`,
`get_active_work_board`, `get_agent_active_work`.

Never use the `orchestrator/*` wildcard — be explicit.

### 4. Pick external MCP servers (if needed)

If the agent needs capabilities beyond GitHub (AWS, Terraform, browsers,
databases, Stripe, etc.), call `list_mcp_registry` to see the approved
menu. Pick the minimum set, request the minimum tools from each, and
request the minimum env vars.

Put them in the agent's frontmatter:

```yaml
mcp_servers:
  - id: <server-id-from-registry>
    tools: [subset of tools_allowed]
    env_required: [subset of env_allowed]
    justification: "<one sentence explaining why this agent needs this server>"
```

**If no registry entry fits**, do NOT inline a new source. Instead invoke
the `add-mcp-server` skill — adding a server to the registry is a
separate, higher-trust PR.

### 5. Create the agent file on a safe branch

```
create_safe_work_branch(issue_number, "coordinator", "add-<name>-agent")
write_file_on_branch(
    ".github/agents/<name>.agent.md",
    content,  # see template below
    branch,
    "feat: add <name> specialist agent"
)
create_pull_request(
    "feat: Add <name> specialist agent",
    branch,
    "main",
    "<Body: what role, why needed, what MCP servers + secrets it uses>"
)
```

**The PR body must surface the agent's MCP servers and required secrets
plainly**, so the human reviewing it can see the blast radius:

```markdown
## New agent: <name>

**Role:** <one-line description>

**MCP servers:** aws-read (medium risk), terraform (high risk)

**Required secrets:** AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION

**Why:** <justification per the issue>
```

### 6. Request human approval

The new agent cannot be used until the PR is merged. Block the issue:

```
request_human_approval(
    issue_number,
    "New agent '<name>' created in PR #XX. "
    "Please review the MCP servers and secrets, then merge so I can delegate work."
)
```

### 7. If the agent needs secrets not yet in GitHub Secrets

After the PR is merged, first check whether the secrets are set. If any
env var in the agent's `env_required` is not yet configured in GitHub
Secrets, call:

```
request_secrets(
    issue_number,
    agent_name="<name>",
    secrets=[missing env var names],
    justification="<why these secrets are needed>"
)
```

The founder will add them in **Settings → Secrets and variables → Actions**
and resume you with a comment.

## Agent file template

```markdown
---
name: <agent-name>
description: >
  <One-line description of what this specialist does and when to use it.>
model: gpt-4o
tools:
  - orchestrator/get_issue
  - orchestrator/list_issue_comments
  - orchestrator/create_issue_comment
  - orchestrator/create_actionable_comment
  - orchestrator/create_info_comment
  - orchestrator/create_safe_work_branch
  - orchestrator/write_file_on_branch
  - orchestrator/create_pull_request
  - orchestrator/ensure_labels_exist
  - orchestrator/mark_issue_working
  - orchestrator/mark_issue_done
  - orchestrator/request_human_approval
  # Memory + tracking (always include all four):
  - orchestrator/store_memory
  - orchestrator/get_agent_memory
  - orchestrator/get_active_work_board
  - orchestrator/get_agent_active_work
  # Secrets flow (include if this agent uses external MCP servers):
  - orchestrator/request_secrets
  # Role-specific tools go here — add only what this agent needs.
  - read
  - edit
  - search
  - write

# Optional: external MCP servers, referenced from .orchestrator/mcp-registry.yaml
# mcp_servers:
#   - id: <registry-server-id>
#     tools: [<subset of the server's tools_allowed>]
#     env_required: [<subset of the server's env_allowed>]
#     justification: "<why this agent needs this server>"
---

# <Agent Display Name> Agent

You are the **<agent-name>** specialist. <Describe the expertise in detail.>

Your emoji identity is: <choose a unique emoji>

## Your Workflow

1. **Read the issue** and any parent/sub-issue context.
2. **Check memory** — call `get_agent_memory("<agent-name>")`.
3. **Check active work** — call `get_active_work_board()` and
   `get_agent_active_work("<agent-name>")`.
4. **Discover skills** — use Copilot's native repo skills from
  `.github/skills/<name>/SKILL.md` for any skill that fits the current task.
  Specialists benefit from skills like `research-first`,
  `software-development-best-practices`, `testing-strategy`, `code-review`,
  and `debugging`.
5. **Ensure labels exist** — call `ensure_labels_exist()`.
6. **Work on a safe branch** — never commit to main.
7. **Open a PR** — clear title, detailed body, link to the issue.
8. **Mark done** — call `mark_issue_done()` on your sub-issue.
9. **Save memory** — call `store_memory()` with learnings that future
   runs (not just this run) should know.
10. **Hand off** if another agent should continue the chain.

## Mandatory Signature

Pass `agent_name="<agent-name>"` to MCP tools so your signature is injected:

- **Actionable (handoff):** `@orchestrator` + `from: <agent-name> <emoji>`
- **Informational (status):** `from: <agent-name> <emoji>` (NO `@orchestrator`)

## Rules

1. Only commit to safe work branches (`ai/` prefix).
2. Use MCP tools for ALL GitHub operations.
3. Always include your agent signature.
4. Never include `@orchestrator` in status-only comments.
5. Call `store_memory` at end of work if you learned something useful.
```

## Related skills

- `add-mcp-server` — when a needed capability is not in the registry yet
- `research-first` — include as a suggested step for the new agent
- `software-development-best-practices` — baseline reading for coding agents
