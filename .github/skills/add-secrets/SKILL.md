---
name: add-secrets
description: How an agent asks the human to add GitHub Secrets an MCP server needs. Never embed secret values in comments or prompts.
audience: [coordinator, any-agent]
triggers:
  - "missing secrets"
  - "env var not set"
  - "MCP server failed to start"
  - "compose_registry_servers returned missing_secrets"
---

# Add Secrets Skill

Use this skill when an MCP server the agent needs requires environment
variables that are not yet set in GitHub Secrets. Never try to work
around missing secrets or suggest placeholder values — stop and ask the
human cleanly.

## When to use

- At agent startup, `missing_secrets` is non-empty for a required MCP server.
- The MCP server subprocess fails at runtime with "required env var missing".
- A newly merged agent needs secrets that the founder has not added yet.

## Steps

### 1. Determine exactly which secrets are missing

From the server's registry entry (`list_mcp_registry`), cross-reference
the agent's `env_required` with the current process environment. Only
report the ones that are actually missing — do not ask the human to
re-add secrets they already configured.

### 2. Call `request_secrets`

```
request_secrets(
    issue_number=<the issue in flight>,
    agent_name="<your agent name>",
    secrets=["ENV_VAR_1", "ENV_VAR_2"],
    justification="<one or two sentences on why these secrets are needed>"
)
```

This will:

- Add the `AI: human-approval` label to the issue (blocks further automation).
- Post a signed info comment telling the human which secrets to add,
  where to add them, and why.

### 3. Stop working

Do NOT proceed with other work on this issue once secrets are requested.
The next orchestration run will be triggered when the human comments
back on the issue.

### 4. On resume, verify then retry

When the run resumes, re-check the env vars. If they're now set,
continue the original work. If still missing, post an info comment
("still missing X, Y — waiting") rather than calling `request_secrets`
a second time (which would just re-send the same comment).

## Rules

1. **Never include secret values in any comment, PR body, log, or prompt.**
   Only secret *names* are safe to mention.
2. **Never guess or fabricate values** to bypass the block.
3. Only ask for secrets that are in the MCP server's `env_allowed` —
   if you want a secret that isn't allowed, that's a registry problem,
   not a secrets problem. Use `add-mcp-server` to widen the allowlist.
4. Explain the **why** in the justification — the human should understand
   what the agent will do with these secrets.
5. One `request_secrets` call per distinct batch of missing secrets.

## What the human sees

The `request_secrets` tool posts a comment roughly like:

```
🔐 Secrets required before I can continue

The `devops` agent needs these GitHub Secrets to run:

  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - AWS_REGION

Why: Run `terraform plan` to show the human what infra changes this PR will make.

How to add them:
1. Go to Settings → Secrets and variables → Actions.
2. Click New repository secret for each name above and paste the value.
3. Return here and comment `@orchestrator secrets added` to resume.
```

## Related skills

- `add-mcp-server` — if the missing secret is not in the server's `env_allowed`, the registry must be updated first
- `add-agent` — when a newly-created agent needs secrets the team has not set
