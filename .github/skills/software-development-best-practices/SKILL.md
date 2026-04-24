---
name: software-development-best-practices
description: Baseline code-quality guidance every coding agent should follow. Small, tested, readable, conventional.
audience: [any-agent]
triggers:
  - "writing code"
  - "implementing feature"
  - "refactoring"
  - "code review"
---

# Software Development Best Practices Skill

This skill captures the non-negotiables every coding agent follows in
this repo, independent of language or stack. When in doubt, bias toward
smaller, simpler, more conventional.

## Core principles

### 1. Match existing conventions

Before inventing anything, look at the two or three nearest existing
examples. Follow their style for:

- File layout (where does this kind of module live?)
- Naming (camelCase vs snake_case, singular vs plural, etc.)
- Error handling (exceptions vs Result types vs sentinels)
- Logging (what logger, what level, what format)
- Imports and dependency direction

If the repo uses a linter or formatter, run it and commit the result.

### 2. Keep changes small and focused

- One PR = one logical change. If you find yourself writing "and also
  …" in the PR description, split it.
- Prefer a sequence of 3 small PRs over 1 large PR. Reviewers catch
  more in small PRs.
- If a refactor is needed to land the fix cleanly, land the refactor
  in its own PR first.

### 3. Write code for the next reader, not the compiler

- Name variables and functions for what they **mean**, not what they
  **contain**.
- Avoid clever one-liners where a clear two-liner exists.
- Functions should do one thing. If the name has "and" in it, split it.
- Prefer explicit over implicit. Avoid magic strings/numbers — name them.

### 4. Comments: only when non-obvious

Good code is mostly self-documenting. Write comments only for:

- **Why**, not what. The code shows what; the comment explains why.
- Non-obvious invariants (`# must run before X or we deadlock`).
- Workarounds for bugs in dependencies with a link.
- Public APIs that outside callers rely on.

Remove stale comments. A wrong comment is worse than no comment.

### 5. Handle the boundaries, trust the core

- Validate at **system boundaries** (HTTP inputs, file reads, external
  API responses). Use a schema where possible.
- **Trust internal code** — don't re-validate data that was validated
  at the boundary. Excessive defensive code hides real bugs.
- Let exceptions propagate when there's no meaningful recovery at this
  layer.

### 6. Tests alongside code

- Every behavior change ships with a test.
- Unit tests for pure logic; integration tests for seams; e2e for
  the user flow.
- A failing test you added **before** the fix is the best proof the
  fix works.
- Don't chase coverage for its own sake — missing tests for hot paths
  beat 100% coverage of trivial getters.

### 7. Avoid premature abstraction

- First occurrence: write it inline.
- Second occurrence: still inline, maybe.
- Third occurrence of the **same pattern**: now consider a helper.
- Never extract a helper based on *anticipated* reuse. You will
  guess wrong.

### 8. Security defaults

- Never log secrets, tokens, or PII. Redact them at the logger layer.
- SQL: always parameterize. Never f-string user input into SQL.
- HTML: always escape user input rendered into templates.
- File paths: never trust user-supplied paths without a canonicalize
  + allowlist check.
- New dependencies: check license, maintenance status, and known CVEs
  before adding.

### 9. Performance: measure before optimizing

- Write the clearest solution first. Profile only if it's too slow.
- N+1 queries are the number one cause of "suddenly slow" endpoints —
  batch loads when iterating.
- Caches must have invalidation. An uninvalidatable cache is a bug.

### 10. Errors should be useful

- An error message should tell the reader:
  - **What** happened,
  - **Where** it happened (context — issue #, file, function),
  - **Why** it might have happened,
  - **What to try next**.
- Logging `"Error"` with no context is worse than no logging.

## Before opening a PR — checklist

- [ ] I can describe the change in one sentence.
- [ ] Tests added or updated to cover the change.
- [ ] Linter / formatter clean.
- [ ] No commented-out code, debug prints, or TODOs I didn't file.
- [ ] PR body explains *why*, not just *what*.
- [ ] Related skills consulted (`code-review`, `testing-strategy`,
  `secure-coding`).

## Related skills

- `research-first` — always do this before writing code
- `testing-strategy` — how to structure the tests you add
- `code-review` — what a reviewer will check for on this PR
- `secure-coding` — security-specific guidance
- `debugging` — when the change breaks something
