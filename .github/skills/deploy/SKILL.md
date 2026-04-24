---
name: deploy
description: Staging-first, human-approved-to-prod deployment workflow. Covers GitHub Environments, preview envs, rollback.
audience: [devops-agent, coordinator]
triggers:
  - "deploy"
  - "ship to staging"
  - "push to production"
  - "release"
  - "roll back"
---

# Deploy Skill

Deploys are the highest-blast-radius thing an agent does. The goal is:

- **Staging is automatic** on merge to main.
- **Production requires a human click**, always.
- **Rollback is as fast as deploy**, so the worst case is short.

## When to use

- Wiring up CI/CD for the first time.
- Adding a new deployable service to an existing repo.
- Promoting a merged change to staging / production.
- Rolling back a bad deploy.

## Core model: GitHub Environments

Two GitHub Environments, different secrets, different approval rules:

| Environment | Required reviewers | Who can trigger | Secrets scope |
|---|---|---|---|
| `staging` | none | any merge to `main` | staging creds |
| `production` | founder(s) | manual promotion | prod creds |

**The approval mechanism is built into GitHub Environments.** Don't
invent a custom approval bot — let the GitHub "Required reviewers"
feature pause the job.

## Pipeline shape

```
PR opened                       → CI: lint + type + test
PR opened                       → preview environment deployed
PR merged to main               → staging deploy (auto)
staging deploy succeeds         → smoke tests (auto)
smoke tests succeed             → production deploy waits for approval
human clicks "Approve" in PR    → production deploy runs
production deploy succeeds      → post-deploy verification
```

Every step either passes cleanly or rolls back. No "manual fix on the
server."

## Workflow YAML sketch

```yaml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging           # loads staging secrets, no approval
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_STAGING_ROLE }}
          aws-region: ${{ secrets.AWS_REGION }}
      - run: make deploy-staging
      - run: make smoke-test

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production        # PAUSES for founder approval
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_PROD_ROLE }}
          aws-region: ${{ secrets.AWS_REGION }}
      - run: make deploy-production
      - run: make post-deploy-verify
```

## Credentials: prefer OIDC over long-lived keys

For AWS / GCP / Azure, use GitHub OIDC:

- **AWS**: `aws-actions/configure-aws-credentials` with `role-to-assume`.
  The workflow gets short-lived STS credentials.
- **GCP**: Workload Identity Federation.
- **Azure**: `azure/login` with federated credential.

No `AWS_ACCESS_KEY_ID` stored in GitHub Secrets → no key to rotate, no
key to leak.

For third-party services (Stripe, SendGrid, Sentry) that don't support
OIDC, use GitHub Environment Secrets scoped to the environment that
needs them.

## Preview environments per PR

Every PR opened gets a throwaway deploy:

- Unique URL, reported back as a PR comment.
- Isolated data (per-PR schema, or seeded-read-only staging DB).
- Automatically torn down on PR close/merge.
- The founder clicks the link, tries the change, **then** approves.

This is the single biggest UX win for a human-only-approves-PRs
workflow. Turns review from "read the diff" into "try the feature."

## Smoke tests (mandatory gate)

After every staging deploy, run smoke tests that verify:

- The deploy succeeded at the infra level (pods healthy, DB reachable).
- The critical user flow works (login → read one entity → logout).
- No errors logged at ERROR level in the first 60 seconds.

If smoke tests fail → auto-rollback → open a GitHub issue → notify the
founder. Do NOT proceed to prod.

## Database migrations

High-risk — call out in every PR description:

- Migrations must be **backwards-compatible** for at least one version:
  deploy the schema change, then the code using it. Don't couple them
  in one deploy.
- `NOT NULL` on a large table = two steps: add nullable, backfill,
  then enforce.
- Test the migration against a **copy of prod data** in staging before
  the prod run.
- Always have a rollback migration ready.

## Rollback

One command or one click. Agents should wire:

- `make rollback` — redeploys the previous tagged image.
- Or revert-PR → auto-deploys on merge.

Rollback time from "decision" to "prod back to previous" should be
< 5 minutes. Practice it in staging.

## Post-deploy verification

After prod deploys:

- Watch error rate for 5–10 minutes. Spike? Roll back.
- Watch latency p95 / p99. Regression > 10%? Investigate, maybe roll
  back.
- Watch the specific metric the change was supposed to move (business
  KPI, conversion, etc.).

## Rules

1. **No manual changes on the server.** Everything goes through a PR
   and a deploy.
2. **No "just this once" bypass.** If the process is wrong, fix the
   process.
3. **One change per deploy.** Bundled deploys make rollbacks
   ambiguous.
4. **Production deploy always has a human approval gate.** Don't remove
   it to "move faster."
5. **Deploys must be reversible.** If a change isn't reversible (e.g.
   data deletion), it needs explicit `request_human_approval` even
   before merge.

## Related skills

- `plan-greenfield` — wiring this up in a new repo from day one
- `add-secrets` — credentials needed before first deploy
- `incident-response` — when a prod deploy goes wrong
- `secure-coding` — deploy workflow must not leak secrets
