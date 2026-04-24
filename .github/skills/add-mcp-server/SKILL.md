---
name: add-mcp-server
description: How to propose a new external MCP server for the team's registry. Registry changes are a trust boundary and require a dedicated PR.
audience: [coordinator, human]
triggers:
  - "capability not in registry"
  - "need an MCP server that isn't approved"
  - "add a new MCP server"
  - "list_mcp_registry returned nothing useful"
---

# Add MCP Server Skill

Use this skill when an agent needs an external capability (AWS, Terraform,
Playwright, Postgres, Stripe, etc.) but `list_mcp_registry` shows no entry
that covers it. The MCP registry at `.orchestrator/mcp-registry.yaml` is
a **trust boundary**: every entry is a promise from the team that this
MCP server is safe for any agent to reference. Adding a new entry must
be a separate, human-reviewed PR — never inlined into another change.

## When to use

- An agent's task requires tools no registry server provides.
- A researched MCP server from the community would close the gap.
- Do NOT use this skill just to grant an agent more tools from a server
  that is already in the registry — instead, widen `tools_allowed` on
  the existing entry (still a PR, but simpler review).

## Steps

### 1. Research the candidate MCP server

Before opening a PR, gather:

- **Source**: official package name + version. Prefer pinned versions
  (`@aws/mcp-server-aws@1.2.0`) over `latest` — unpinned versions break
  the trust guarantee because the code can silently change.
- **Maintainer**: is it official (Anthropic, AWS, Playwright) or
  community? Official is preferred; community is fine if reputable.
- **Transport**: stdio (most common) or http.
- **Tools exposed**: list every tool the server offers and their docs.
- **Env vars required**: what credentials, endpoints, or config it reads
  from the environment.
- **Known risks**: can it mutate state? make paid API calls? access
  sensitive data? External network calls?

### 2. Pick a minimal exposure

Decide the **subset** of the server's capability the team will allow:

- `tools_allowed` — list only the tools the team wants any agent to use.
  You can always widen later.
- `env_allowed` — list only env vars the team is comfortable having any
  agent request. Never add an env var that no server needs.
- `risk` — pick `low` / `medium` / `high` based on blast radius:
  - `low`: read-only, sandboxed (e.g. Playwright)
  - `medium`: read-only access to production data/accounts
  - `high`: can mutate infra, charge money, or write to production

### 3. Open a dedicated PR

One PR. One server. No unrelated changes — this is a trust boundary PR.

```
create_safe_work_branch(issue_number, "coordinator", "mcp-registry-add-<server-id>")
```

Read the current `.orchestrator/mcp-registry.yaml`, append the new entry,
and commit:

```
write_file_on_branch(
    ".orchestrator/mcp-registry.yaml",
    updated_content,
    branch,
    "feat(mcp-registry): add <server-id> server"
)
create_pull_request(
    "feat(mcp-registry): add <server-id> to approved MCP servers",
    branch,
    "main",
    "<body per the template below>"
)
```

### 4. PR body template (required)

```markdown
## New MCP server: `<server-id>`

**Source:** `<npm package>@<pinned version>` (official | community)
**Transport:** stdio | http
**Risk:** low | medium | high
**Description:** <one line>

## Tools exposed

| Tool | Purpose | Side effects |
|---|---|---|
| <tool_a> | <what it does> | read-only / mutates / paid call |
| <tool_b> | ... | ... |

## Env vars required

| Name | Purpose | Scope |
|---|---|---|
| `<VAR>` | <purpose> | read-only / read-write |

## Why this is safe

<2–3 sentences on blast radius, sandboxing, scoping.>

## Alternatives considered

<Other servers evaluated; why this one won.>
```

### 5. Request human approval explicitly

```
request_human_approval(
    issue_number,
    "Proposing new MCP server '<server-id>' in PR #XX. "
    "This is a registry change — please review tools_allowed and env_allowed carefully."
)
```

### 6. After merge

Once merged, any agent can reference the new server in its frontmatter.
Note: merging the registry entry **does not** grant any specific agent
access — each agent that wants to use the server still declares it in
its own `mcp_servers:` block, which goes through its own PR review.

## Registry entry template

```yaml
<server-id>:
  command: npx                          # or: uvx, docker, <absolute path>
  args: ["-y", "<pkg>@<version>"]       # stdio transport
  transport: stdio                      # or: http (set url instead of command/args)
  # url: "https://mcp.example.com/sse"  # when transport: http
  env_allowed:
    - ENV_VAR_NAME
  tools_allowed:
    - tool_name_a
    - tool_name_b
  risk: low                             # low | medium | high
  description: "<one-line summary shown in PR reviews and coordinator prompts>"
```

## Rules

1. One server per PR. Never batch.
2. Pin the version. `latest` is not acceptable in the registry.
3. `tools_allowed` is a strict subset, not a wildcard.
4. `env_allowed` never contains anything the server does not legitimately need.
5. Document risks plainly in the PR body — this is what the human reviewer reads.
6. If uncertain about risk, default up (medium → high).

## Related skills

- `add-agent` — after the registry entry is merged, use this to wire the server into a new agent
- `add-secrets` — if the new server needs env vars not already in GitHub Secrets
