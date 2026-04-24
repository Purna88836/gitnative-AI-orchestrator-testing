---
name: decompose-issue
description: How the coordinator breaks a complex issue into parallelizable sub-issues, each assignable to one agent.
audience: [coordinator]
triggers:
  - "complex issue"
  - "multi-domain work"
  - "too big for one agent"
  - "needs decomposition"
---

# Decompose Issue Skill

Complex issues get broken into sub-issues before any work starts. A good
decomposition turns a scary one-week task into a stream of 1–4 hour
agent tasks that can run in parallel or in a clear chain.

## When to use

- The issue spans multiple domains (frontend + backend + infra).
- The expected diff is > 300 lines.
- The issue description uses plural ("add endpoints", "multiple pages").
- Unclear ownership — you can't point at one agent and say "this is
  yours."

Skip decomposition for narrow single-domain issues (typo, config
tweak, one-function fix).

## Steps

### 1. State the outcome first

Write (in an info comment on the parent issue) the **end state** the
user will see when all sub-issues are done. Not "implement auth" but
"users can sign up with Google, stay logged in for 7 days, and log
out." That becomes the acceptance criteria for the parent.

### 2. Identify the natural seams

Seams are where one agent's output becomes another agent's input. Good
seams:

- **Data shape** — a database schema, an API contract, a TypeScript
  type. Define the seam, and backend + frontend can work in parallel.
- **Capability boundary** — "backend exposes X" and "frontend consumes
  X."
- **Pipeline stage** — research → design → implement → test → deploy.

Draw the seams before writing sub-issue titles.

### 3. One sub-issue per agent per seam

Each sub-issue should:

- Be assignable to exactly one specialist.
- Have a clear, testable "done" criterion.
- Fit in 1–4 hours of agent work. If bigger, split again.
- Name the dependencies explicitly in the body ("blocked by #X").

### 4. Sub-issue title format

`<Agent>: <verb> <object>`

Examples:

- `backend: add POST /api/orders endpoint`
- `frontend: build OrderForm component`
- `database: migrate orders table with created_at index`
- `qa: integration test for order creation happy path`
- `devops: add orders service to staging deploy pipeline`

### 5. Sub-issue body template

```markdown
Parent: #<parent number>

## Goal

<One sentence the assignee can act on directly.>

## Depends on

- #<other sub-issue number> (if any)
- <or: none>

## Done when

- [ ] <Specific criterion 1>
- [ ] <Specific criterion 2>

## Context

<Relevant links: parent issue, related PRs, shared types, design docs.>

## Out of scope

<What this sub-issue explicitly does NOT cover — usually a future
sub-issue.>
```

### 6. Create the dependency graph

In an info comment on the parent issue, draw the order:

```
#42 ──┬── #43 (backend endpoint)       ─┐
      │                                 ├── #45 (integration test)
      └── #44 (database migration) ────┘
      ↓
      #46 (frontend form) ── depends on #43
      ↓
      #47 (deploy)
```

This makes it obvious what can be parallelized and what's on the
critical path.

### 7. Delegate — idle agents first

Call `get_agent_active_work("all")`. Give leaf sub-issues (no
dependencies) to idle agents first. Hold dependent sub-issues until
their prerequisites are done, or give them "blocked-by" guidance in
the actionable comment.

### 8. Track progress on the parent

On the parent issue, keep an info-comment progress tracker updated as
sub-issues close:

```
📋 Progress:
- [x] #43 backend endpoint (merged)
- [x] #44 database migration (merged)
- [ ] #45 integration test (in review)
- [ ] #46 frontend form (working)
- [ ] #47 deploy (blocked on #46)
```

When all sub-issue boxes are checked, mark the parent done.

## Common pitfalls

- **Decomposing too finely**: "sub-issue per function" is overkill. Aim
  for meaningful chunks, not micro-tasks.
- **Decomposing too coarsely**: "backend: build the whole API." That's
  not a sub-issue, that's another complex issue needing its own
  decomposition.
- **Forgetting the integration step**: individual components work, but
  nobody wired them together. Always include an end-to-end verification
  sub-issue.
- **Hidden coupling**: "frontend" and "backend" sub-issues both end up
  modifying the same shared type file → merge conflicts. Put the
  shared-type change in its own sub-issue that runs first.

## Related skills

- `add-agent` — if a needed specialist doesn't exist yet
- `research-first` — sometimes you need research before you can
  decompose
- `plan-greenfield` — decomposition for brand-new projects
- `pr-hygiene` — each sub-issue becomes a PR; these rules apply
