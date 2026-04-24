---
name: help
description: Context-aware help for the human — tells them what's happening on the current issue and what they can do next.
audience: [coordinator, human]
triggers:
  - "/help"
  - "what can I do"
  - "I'm lost"
  - "what's next"
  - "status"
---

# Help Skill

The founder may be unfamiliar with the orchestrator's conventions. When
they comment `@orchestrator /help` (or equivalent), the coordinator
uses this skill to give **context-specific** guidance on the current
issue — not a generic manual dump.

## When to use

- The human comments `/help` on an issue.
- The human asks "what's happening" or "what's blocking this."
- A long-stalled issue needs a status refresh.

## Steps

### 1. Read the issue state

- Current labels (`AI: working`, `AI: human-approval`, `AI: blocked`,
  `AI: done`).
- Recent comments and who posted them (agents vs humans).
- Linked PRs and their review status.
- Sub-issues and their states.
- Last activity timestamp.

### 2. Classify the situation

| State | Typical human action |
|---|---|
| `AI: working` + recent agent activity | Wait. Agents are working. No action needed. |
| `AI: working` + no activity > 24h | The agents may be stuck — post info comment asking for status. |
| `AI: human-approval` | You need to do something (see below). |
| `AI: blocked` | Agent can't proceed — read last comment for what's missing. |
| PR open awaiting review | You're the reviewer — read the PR, merge or request changes. |
| `AI: done` | Complete. Close the issue when satisfied. |

### 3. Tell the human *specifically* what to do

Post an info comment with their options. Examples:

**Scenario A — awaiting approval on a new agent PR**

```
from: coordinator 📋

📋 Status: waiting for you to review PR #42.

What you need to do:
1. Open [PR #42](link). Review the new agent file and its MCP server list.
2. If it looks good, merge. I'll resume immediately.
3. If you want changes, request changes on the PR — I'll iterate.

What this PR does: adds a `devops` agent that uses the `aws-read` MCP
server to analyze current AWS cost before proposing infra changes.
Required secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION.
```

**Scenario B — agent needs secrets**

```
from: coordinator 📋

📋 Status: blocked on missing GitHub Secrets.

What you need to do:
1. Open [Settings → Secrets and variables → Actions](link).
2. Add these secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
3. Come back and comment `@orchestrator secrets added`.

Why: the `devops` agent will use these to read (read-only) AWS cost
data before proposing changes.
```

**Scenario C — nothing blocking; work is in flight**

```
from: coordinator 📋

📋 Status: work in progress. No action from you right now.

In flight:
- [#43] backend agent is implementing the /orders endpoint (last update 12 min ago).
- [#44] frontend agent is building the Orders page (last update 5 min ago).

I'll tag you when I need your review. Expected next touchpoint: the PR review.
```

**Scenario D — stuck for a long time**

```
from: coordinator 📋

📋 Status: this issue has been quiet for 2 days — might be stuck.

Possible next steps:
1. Post `@orchestrator retry` to have me re-plan.
2. Close the issue as not-planned if it's no longer needed.
3. Comment with any additional context that might unblock me.
```

### 4. Keep the tone friendly and specific

- No generic boilerplate. Always reference issue numbers, PR numbers,
  agent names, specific labels.
- Short sentences. The human is usually in a hurry.
- Link to everything. Don't make the human go hunting.

## Related skills

- `add-secrets` — if the help case is missing secrets, reference this skill
- `add-agent` — if the help case is a pending agent-birth PR
- `incident-response` — if the help case turns out to be a SEV, escalate
