---
name: debugging
description: Structured approach to isolating and fixing bugs — reproduce, narrow, root-cause, fix, verify, prevent.
audience: [any-agent]
triggers:
  - "bug"
  - "something broke"
  - "test failing"
  - "works locally but not in prod"
  - "workflow failure"
  - "CI red"
---

# Debugging Skill

Bugs have causes, not moods. The fastest path to a fix is a disciplined
reproduction, then binary search.

## When to use

- A test is failing and you don't know why.
- A workflow/CI run failed.
- The user reports unexpected behavior.
- Something that worked yesterday doesn't today.

## Steps

### 1. Reproduce it reliably

A bug you can't reproduce is a bug you can't fix. First step is always
to make the failure happen on demand:

- Minimal reproduction: the smallest input, command, or sequence that
  triggers the failure.
- Capture the exact error, stack trace, and context.
- Note what changes the outcome (timing, input size, concurrency).

If you can't reproduce it, the fix is: add better logging / telemetry
first, not speculation. Speculation compounds into wrong fixes.

### 2. Read the error properly

The stack trace tells you the location. It doesn't always tell you the
cause. Trace up the call stack:

- Where did the bad value come from?
- What was the last place the code checked it?
- Is the error message the real error, or a secondary failure caused
  by something earlier?

For workflow failures: call `get_failed_jobs(run_id)` and
`get_job_logs(job_id)`. Read the **full** log, not just the tail.

### 3. Narrow with binary search

The bug is somewhere between "works" and "doesn't work." Halve the
space each step:

- `git log` — which commit introduced the failure? `git bisect` if
  you can.
- Which layer: is it the controller, the service, the repository, the
  database? Prove each, don't guess.
- Disable half the recent changes in your branch; does the bug
  persist? That's your half.

### 4. Identify the root cause, not the trigger

The trigger is "this input made it crash." The root cause is "the code
assumed X but X isn't always true." Fix the root cause.

Ask "why" five times:

1. Why did the request fail? → 500 response.
2. Why? → SQL query raised.
3. Why? → Query had a malformed parameter.
4. Why? → We didn't validate the parameter shape.
5. Why? → The schema changed and our validator didn't.

Fix is at step 5, not step 1.

### 5. Write the failing test first

Before fixing, write a test that fails **because of this bug**. Run it.
Confirm it fails for the reason you expect. This test:

- Proves the bug exists.
- Will prove the fix works.
- Will prevent regression.

If the bug is not test-reproducible (e.g. race condition), explain why
in a code comment and add logging/metrics instead.

### 6. Fix the root cause, minimally

- Smallest change that makes the failing test pass.
- Don't refactor in the same PR — that hides the fix.
- Don't "improve" unrelated code while you're in the file.

### 7. Verify

- Run the failing test — it passes.
- Run the full test suite — nothing else broke.
- For production bugs: verify on a preview/staging environment before
  merging.

### 8. Prevent the class

Before closing the issue, ask: what other places in the code have the
same assumption? If the root cause was "we assumed X is never null" and
we have 12 other places assuming X is never null, file those as
follow-up issues now.

## Common pitfalls

- **Fixing the symptom**: "the test is flaky, I'll add a retry." The
  test is flaky for a reason; find it.
- **Speculative fixes**: "maybe this will work." If you're not sure why
  it fixes the bug, it probably doesn't — and if it does, you can't
  explain it in the PR.
- **Scope creep**: fix one bug per PR. File the others.
- **Not reading the log**: scrolling past 90% of the error output
  because "it's just the stack trace." Read it.

## Related skills

- `research-first` — debugging *is* research with a narrower scope
- `testing-strategy` — the failing test is part of the fix
- `code-review` — reviewers catch regressions your tests missed
- `incident-response` — when the bug is currently breaking production
