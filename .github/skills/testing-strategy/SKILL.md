---
name: testing-strategy
description: How to decide what to test, at which layer, and when. Tests should defend behavior, not implementation.
audience: [any-agent]
triggers:
  - "writing tests"
  - "test plan"
  - "what should we test"
  - "flaky test"
  - "test coverage"
---

# Testing Strategy Skill

Tests are a safety net for future change. They're not a checkbox. Bad
tests (slow, flaky, implementation-coupled) cost more than they save.

## When to use

- Adding new behavior.
- Fixing a bug (write the failing test first).
- Reviewing a PR that doesn't have tests.
- Debugging a flaky test.
- Planning test coverage for a new module.

## The test pyramid, pragmatic version

```
   /\
  /e2e\       Few. Expensive. User-facing flows only.
 /------\
 /integ. \    Some. Test seams: DB, HTTP, queues.
/----------\
/   unit    \ Many. Cheap. Pure logic, no I/O.
--------------
```

**Rule of thumb:** a test should fail when behavior the user cares about
breaks, and should **not** fail when you refactor internal code.

### Unit tests

- Test pure functions and small classes without touching I/O.
- One behavior per test. If you need `if` in a test, split it.
- Use real values over mocks when trivially possible.
- A unit test should run in single-digit milliseconds.

### Integration tests

- Test seams: a real database, a real HTTP client against a fake server,
  a real file system.
- Hit the actual SQL / ORM — mocked DB queries mask migration bugs.
- Use test containers or per-test schemas so parallel runs don't
  collide.
- Tolerable runtime: hundreds of milliseconds.

### End-to-end tests

- One per critical user journey — login, checkout, "the one flow the
  business would page me over."
- Run against a fully wired deployment (ideally a preview environment).
- Expensive, so keep them few. Seconds to minutes is OK.
- Every e2e failure should map to a real user regression.

## What to test

### Always

- Public API contracts your team or other callers depend on.
- Regressions — every bug fix gets a test that would have caught it.
- Security-sensitive paths (auth, authz, input validation, SQL-building).
- Edge cases the code claims to handle (nulls, empty collections, huge
  inputs, concurrent calls).

### Usually

- New features, at the unit level, for every reachable branch.
- Integration tests for modules that interact with external systems.

### Rarely

- Trivial getters / setters / passthroughs.
- Third-party libraries (trust them until proven otherwise).
- Internal helpers that will change frequently.

## Writing a good test

1. **Name it for the behavior**: `test_returns_empty_when_user_has_no_orders`,
   not `test_get_orders_case_3`.
2. **Arrange → Act → Assert** in clear blocks.
3. **One failure mode** per test — if it can fail for two reasons,
   it will, and you won't know why.
4. **No sleeps.** If the system is async, use proper awaiting; don't
   add `sleep(0.5)` hoping the race goes your way.
5. **Fixtures over setup sprawl.** Shared setup goes in conftest /
   shared helpers.
6. **Deterministic.** No real time, no real randomness, no real
   network. Inject them.

## Debugging a flaky test

Flakiness always has a cause. Don't just add retries:

1. Run the test in isolation 20×. If it still fails sometimes, the test
   is flaky. If not, it fails only when run alongside other tests —
   shared state / ordering issue.
2. Check for: real time, real randomness, parallel DB writes, unclosed
   connections, absolute thread assumptions, external network.
3. Fix the root cause, not the symptom. Mark the test `@flaky` only if
   you've tried and failed to fix it — then file an issue to remove
   that annotation.

## Coverage as a signal, not a goal

- Coverage dropping on a PR is a signal: "you added code without
  tests." Investigate, don't just enforce a number.
- 80% coverage of hot paths beats 100% of trivial code.
- Uncovered `except` branches are fine IF the exception is reraised.

## Checklist before a test-bearing PR

- [ ] Test names describe behavior, not implementation.
- [ ] No `sleep`, no real network, no real clock, no shared mutable state.
- [ ] New tests fail on the unpatched code, pass on the patched code.
- [ ] No tests committed in skipped state.
- [ ] Test suite runs in the same time ± 10% as before (no new slow tests).

## Related skills

- `research-first` — understand the code before writing tests for it
- `debugging` — tests are the scientific method in miniature
- `software-development-best-practices` — the code under test should follow these too
