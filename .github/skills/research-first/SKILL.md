---
name: research-first
description: Structured research pass an agent should do before writing code. Prevents rework and protects against touching the wrong files.
audience: [any-agent]
triggers:
  - "unfamiliar codebase"
  - "before implementing"
  - "greenfield"
  - "large change"
  - "refactor"
  - "new feature"
---

# Research-First Skill

Any non-trivial code change should start with a research pass. The goal
is to understand the **real** problem, the existing code, and the
constraints **before** writing code — not after.

## When to use

- Any issue with non-trivial scope (more than a one-line fix).
- Before adding a new file or module.
- Before refactoring existing code.
- When the issue description is ambiguous.
- When the existing code uses patterns you're not sure about.

Skip this skill only for trivial fixes (typo, obvious one-line change,
doc-only edits).

## Steps

### 1. Re-read the issue with fresh eyes

- What is the *actual* user outcome? Not "add endpoint X" but "let users
  do Y, which today they can't because of Z."
- What would make this change obviously wrong? Write it down.
- Any mentioned file paths, agents, or labels? Note them.

### 2. Discover the relevant surface area

Use `list_repository_files` and `read_repository_file` (do NOT write
files yet):

- **Entry points**: top-level `main.py`, `app/`, route files, CLI
  handlers — where would a request flow in?
- **Adjacent code**: files that mention the relevant domain nouns.
  Grep for them.
- **Existing patterns**: if you're adding an API endpoint, read three
  existing endpoints first. Copy the pattern, do not invent.
- **Tests**: read adjacent tests to understand the contract.

### 3. Map the dependency chain

Trace: caller → interface → implementation → storage. Understanding who
calls what makes it clear which change is safe and which is a breaking
API change.

### 4. Check memory

Call `get_agent_memory(<your-name>)` for decisions, architectural
patterns, and past mistakes. Call `get_active_work_board()` to see if
related work is already in flight — you might depend on another agent's
output or step on their toes.

### 5. State assumptions explicitly

Before writing code, post a brief info comment on the issue with:

- **What I understand the goal to be**
- **Key files / patterns I'll touch**
- **Assumptions** ("I'm assuming Postgres is the primary store")
- **What I will NOT change** in this PR

If an assumption is uncertain, call `request_human_approval` and ask.
Five minutes of research saves a rewrite.

### 6. Only now, start implementation

Create the branch, implement, open the PR. Reference the research in
the PR body so the reviewer doesn't repeat it.

## Anti-patterns to avoid

- **Writing code before reading code.** You will duplicate or conflict
  with what's already there.
- **Inventing a pattern** when the repo already has one. Match existing
  conventions unless you have a documented reason to deviate.
- **Assuming the issue title is the full story.** Read the body, all
  comments, and the parent issue if any.
- **Researching too much.** After 10–15 minutes of reading, if you're
  not converging, ask the human.

## Related skills

- `software-development-best-practices` — what to do with the knowledge once researched
- `debugging` — research-first is the first step of debugging too
- `help` — call this skill if you're researching and still stuck
