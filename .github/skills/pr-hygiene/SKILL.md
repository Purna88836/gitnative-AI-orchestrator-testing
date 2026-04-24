---
name: pr-hygiene
description: How to open a pull request the reviewer will actually enjoy reviewing. Small, well-described, test-carrying, on-topic.
audience: [any-agent]
triggers:
  - "opening a PR"
  - "create_pull_request"
  - "ready for review"
---

# PR Hygiene Skill

Every PR an agent opens is an artifact the human (or reviewer agent) has
to parse. A well-shaped PR gets reviewed fast and merged sooner. A sloppy
PR stalls in the queue and breeds mistrust in the whole orchestration.

## When to use

- Before calling `create_pull_request`.
- When reviewing your own draft before marking it ready.
- Any time `create_pull_request` is about to send something >300 lines.

## Rules

### 1. One topic per PR

- If the description needs "and also…" — split.
- Refactor + feature = two PRs. Refactor lands first.
- Drive-by fixes go in a separate PR, not tacked on.

### 2. Small is a feature

Target: **≤ 300 lines** of meaningful diff. Above 500 and the review
quality drops sharply. Above 1000, reviewers skim. If the change
fundamentally can't be split, say so in the description and offer to
walk the reviewer through it.

### 3. Clear title

`<type>(<scope>): <one-line imperative summary>`

Examples:

- `feat(api): add /orders POST endpoint`
- `fix(frontend): prevent duplicate submit on Enter key`
- `refactor(db): extract Order repository from service`
- `chore(ci): pin action versions to SHA`

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`.
No emojis in the title.

### 4. Description template

```markdown
## What

<2–4 sentences: what this PR does at a user / behavior level.>

## Why

<Link to the issue. Brief context: why this change, why now.>

## How

<Only the non-obvious bits. Architecture choices, trade-offs. Skip
if trivial.>

## Testing

- <how you verified this locally>
- <tests added / updated: file paths>
- <what you did NOT test, and why>

## Screenshots / preview

<For UI changes. Or link to the preview environment URL.>

## Risk + rollback

<Any migration? Data change? Irreversible action? How to roll back
if this goes wrong.>

## Checklist

- [ ] Follows the patterns in adjacent code
- [ ] Tests added for new behavior
- [ ] Linter / formatter clean
- [ ] No new deps without `secure-coding` check
- [ ] Related skill consulted: <name>
```

### 5. Self-review before requesting review

- Walk the diff yourself.
- Remove commented-out code, debug prints, stray TODOs.
- Make sure your test names describe behavior, not implementation.
- Ensure the first commit title matches the PR title.

### 6. Link everything

- The issue this closes (`Closes #42`).
- The parent issue if this is a sub-task.
- Related PRs in the same chain.
- External docs (RFC, design doc) if they drove the decision.

### 7. Mark draft if not ready

Use draft PRs for work-in-progress. Converting draft → ready is the
signal to reviewers "I want your time now."

### 8. Respond to reviews like a good collaborator

- Don't silently `git push`. Reply to the comment thread explaining
  what you changed.
- For comments you won't act on: say why. "Good point, but out of
  scope for this PR — filed #45."
- Resolve threads only after you've addressed them.

## Anti-patterns

- **Kitchen-sink PR**: refactor, new feature, bug fix, style churn all
  in one. Split.
- **Stealth dependency bumps**: hiding package updates in an unrelated
  PR. Bumps get their own PR.
- **"Fix typo" PRs that also change 3 files of logic**: pick one.
- **Marking ready-for-review without self-reviewing**: you'll catch
  50% of your own issues.
- **Title = the issue title**: that's not a PR title. The PR title
  says what *this PR* does.

## Related skills

- `code-review` — the mirror of this skill, for reviewing others
- `testing-strategy` — the "Testing" section of the PR body
- `secure-coding` — the security checklist
- `software-development-best-practices` — the underlying code style
