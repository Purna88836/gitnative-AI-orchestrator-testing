---
name: code-review
description: Playbook for reviewing a pull request — what to check, how to leave useful review comments, when to block vs nudge.
audience: [any-agent, human]
triggers:
  - "reviewing a PR"
  - "pull request review"
  - "review this code"
  - "before merging"
---

# Code Review Skill

A good review catches real bugs, improves clarity, and teaches without
being patronizing. A bad review is a rubber stamp or a personal
stylebook. Aim for the first.

## When to use

- Reviewing a PR opened by another agent or a human.
- Doing a self-review before opening your own PR.
- Post-merge audit for high-risk changes.

## Steps

### 1. Understand the goal of the change

Read the PR description first. What problem does this solve? What's
the intended scope? If you can't tell, ask in a comment — don't start
picking at code you don't understand.

### 2. Run the code in your head (or in a sandbox)

- Trace the happy path: what does a normal call look like?
- Trace the failure modes: what happens if the DB is down / the input
  is empty / the user isn't authenticated?
- Look for silent failures: caught exceptions that swallow, defaults
  that hide errors, `return None` where an error should propagate.

### 3. Check by category

#### Correctness (blocker-class)

- Does the code do what the PR description claims?
- Off-by-ones, null/None handling, empty collections, concurrent
  access.
- Side-effect ordering: is state mutated before validation? After
  logging?
- Transactional integrity: are partial writes possible?

#### Security (blocker-class)

- Input validation on every untrusted boundary.
- SQL uses parameterized queries (no f-string concatenation).
- Secrets are not logged or returned in error bodies.
- Auth/authz: every new route is scoped to who can access it.
- Dependency additions: license, supply-chain risk, maintenance.

#### Tests (blocker-class for non-trivial changes)

- Every behavior change has a test covering it.
- Tests fail on the unpatched code.
- No `sleep`, no real network, no shared state leakage.
- New flaky tests are unacceptable.

#### Readability (nudge-class)

- Would a new team member understand this in 30 seconds?
- Variable names carry meaning.
- Functions do one thing.
- No commented-out code, no stray TODOs.

#### Architecture (nudge-class unless clearly wrong)

- Fits existing patterns, or explains why it deviates.
- Dependency direction makes sense (no inner layer importing outer).
- Extension point, not an inline if-else chain, for future cases.

#### Performance (case-by-case)

- N+1 queries when iterating.
- O(n²) where n is user-controlled.
- Missing index for a new query pattern.
- Synchronous call in an async path.

### 4. Leave useful comments

- **Start with the positive**: "nice test coverage here" costs you
  nothing and builds trust.
- **Specific > vague**: "this breaks if `name` is `None` — we get
  `AttributeError` on line 42" beats "looks brittle."
- **Question, don't prescribe, for style choices**: "is there a
  reason we're not using the existing `parse_user` helper here?"
- **Prescribe, clearly, for correctness**: "this must use a
  parameterized query — f-string SQL is a SQL injection."
- **Link to the pattern or doc** you're referencing, not just the
  assertion.

### 5. Label your comments

Use prefixes so the author knows what to act on:

- `blocker:` — do not merge until resolved
- `suggestion:` — the author's call
- `nit:` — tiny thing, author can ignore
- `question:` — I don't understand, please clarify
- `praise:` — this is good, keep doing it

### 6. Decide: approve, request changes, or comment

- **Approve** — blockers are addressed; remaining items are fine
  either way.
- **Request changes** — at least one blocker. Be specific about what
  unblocks the PR.
- **Comment** — unresolved discussion; not yet a verdict.

### 7. After merge

If the change is high-risk, skim the first production metrics / logs
to make sure nothing regressed. File a follow-up issue for anything
you flagged as "do this separately."

## What NOT to do

- **Rewrite the PR in your head, then comment.** If your review is
  effectively "I would have done this differently," just approve and
  raise the larger architecture question separately.
- **Bikeshed on style** when there's no linter rule for it.
- **Block a fix because it's not a refactor.** Landable improvement >
  perfect PR.
- **Leave 40 nits on a PR that needed real feedback on 2 things.**
  Pick your battles.

## Related skills

- `secure-coding` — most security blockers in reviews come from this list
- `testing-strategy` — what "adequate tests" actually means
- `software-development-best-practices` — the review happy path
