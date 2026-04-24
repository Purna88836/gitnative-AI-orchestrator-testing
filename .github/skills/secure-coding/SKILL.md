---
name: secure-coding
description: Baseline security rules every coding agent must follow. Injection, auth, secrets, dependencies, file IO, PII.
audience: [any-agent]
triggers:
  - "handling user input"
  - "database query"
  - "auth"
  - "login"
  - "password"
  - "api key"
  - "secret"
  - "file upload"
---

# Secure Coding Skill

Security bugs are different from normal bugs: a subtle one can cost the
company the company. Every agent that touches user-facing code must
treat this skill as a hard checklist, not a suggestion.

## Non-negotiable rules

### 1. Never concatenate user input into code or queries

- **SQL**: parameterize with the driver's placeholder syntax. Never use
  f-strings, `%` formatting, or `.format()` to build queries.
- **Shell**: prefer `subprocess.run([...args], shell=False)`. Never
  `os.system(f"{user_input}")`.
- **Templates**: render with the template engine's auto-escape on. Never
  construct HTML by string concatenation.

### 2. Never log secrets or PII

- Tokens, API keys, passwords, session IDs, OAuth tokens: redact before
  logging. Ideally filter at the logger level so you can't leak them
  accidentally.
- PII (emails, phone numbers, full names, addresses) should be hashed or
  pseudonymized in logs unless there's a real debugging reason.
- Full request/response bodies in logs are dangerous — they almost
  always contain one of the above.

### 3. Treat every input as hostile until validated

- Validate at the **system boundary** (HTTP handler, CLI parser, file
  reader) with a schema.
- Reject, don't sanitize. "Sanitizing" SQL injection is a losing game;
  parameterizing is the win.
- Accept a known-good set of values (allowlist) where possible, not a
  known-bad set (denylist).

### 4. Authentication and authorization

- **AuthN** (who are you?): verify on every request. Never trust a
  client-supplied "user_id" field.
- **AuthZ** (can you do this?): every endpoint / action must have an
  authorization check even if it "feels internal." The classic bug is
  "I can read other users' data by changing an ID in the URL."
- Default to deny. Explicit allow. Admin tools are the highest target,
  not the lowest.

### 5. Secrets management

- Secrets live in GitHub Secrets / Secrets Manager / Vault — never in
  code, never in the repo, never in a config file committed to git.
- If you spot a secret in the repo, rotate it immediately, then remove it
  from history.
- See the `add-secrets` skill for the agent's flow when an MCP server
  needs secrets.

### 6. Dependencies

- Pin versions. Unpinned = unknown code running in production tomorrow.
- Before adding a new dep: who maintains it? When was the last commit?
  Is the license compatible? Any known CVEs?
- Minimize transitive bloat — pulling in one helper that drags 40 more
  packages is a supply-chain risk.

### 7. File IO

- Never trust user-supplied file paths. Canonicalize and check they're
  inside an allowlisted directory.
- Never trust user-supplied filenames. Sanitize or generate your own.
- Serving files: set the right `Content-Type` and
  `Content-Disposition: attachment` for untrusted content.
- Upload size limits at the HTTP server, not just the app.

### 8. Randomness and crypto

- Need a random token / ID? Use `secrets.token_urlsafe()` or the
  language's CSPRNG — never `random.random()`.
- Passwords: hash with `bcrypt` / `argon2` / `scrypt`. Never MD5, SHA1,
  or plain SHA256. Always per-user salt.
- Don't implement crypto. Use a well-reviewed library. If you think
  you've found a novel algorithm, you haven't.

### 9. Errors must not leak internals

- 500 errors to the user: generic message ("internal error") + a
  correlation ID.
- Never echo back the exception message, stack trace, or SQL to
  untrusted users.
- Keep internal error details in the server log, keyed by the
  correlation ID.

### 10. Rate limiting and abuse paths

- Every public endpoint has a budget: per-IP, per-user, per-key.
- Login and password-reset endpoints especially — they're credential
  stuffing targets.
- Webhooks and callbacks must verify signatures; replay protection via
  nonce or timestamp.

## Before opening a PR touching user input, auth, or secrets

- [ ] All user input validated at the boundary with a schema.
- [ ] All SQL / shell / template calls parameterized or escaped.
- [ ] New endpoint has explicit authorization check.
- [ ] No new dependency without reviewing maintenance + CVEs.
- [ ] No secrets in code, config, or test fixtures.
- [ ] Logs do not contain tokens, PII, or full request bodies.
- [ ] Errors do not leak internals to the user.

## Related skills

- `code-review` — reviewers use this exact checklist on security-sensitive PRs
- `add-secrets` — how to request secrets cleanly from the human
- `software-development-best-practices` — general quality guidance
