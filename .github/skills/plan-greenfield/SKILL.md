---
name: plan-greenfield
description: How to scaffold a brand-new project from a founder's idea — stack choice, repo structure, CI/CD, and the first issues to file.
audience: [coordinator, architect-agent]
triggers:
  - "new project"
  - "build me a X"
  - "greenfield"
  - "scaffold"
  - "start from scratch"
  - "empty repo"
---

# Plan Greenfield Skill

Use when the founder gives a one-paragraph idea and the repo has nothing
to build on. The goal is a **runnable skeleton** — deployed, CI wired,
one end-to-end happy path — before any feature work begins. Feature
work on an unpaved road is 3x slower and full of rewrites.

## When to use

- The repo has no application code yet (only workflows / config).
- The issue describes a product (`"build a SaaS todo app"`) rather than
  a change.
- The coordinator is deciding whether to delegate the whole thing or
  break it down first — always break down first.

## Steps

### 1. Interrogate the brief

Before planning, make the scope explicit. Post an info comment on the
issue with:

- **Product in one sentence** (your interpretation).
- **Who the user is** (customer, internal, both).
- **Must-have for the v1 skeleton** (e.g. login, one CRUD entity, one
  deployed URL).
- **Explicit non-goals** for v1 (billing, admin panel, mobile, etc.) —
  file these as future issues.
- **Key constraints** (target cloud, required compliance, budget signal).

If any of these are ambiguous, `request_human_approval` with the
questions. A 20-minute clarifying conversation saves a week of rework.

### 2. Choose the stack conservatively

Default to boring, well-trodden stacks unless the founder names a
preference. Examples:

- **Web SaaS**: Next.js + Postgres + Prisma, deploy to Vercel (UI) and
  Fly/Render/AWS ECS (API if separate).
- **Internal tool / dashboard**: same plus auth0 / NextAuth.
- **Data product**: FastAPI + Postgres + Cloudflare Workers.
- **Mobile**: Expo (React Native) + same backend.

Don't pick exotic stacks unless the founder asks. Boring = fast
onboarding for the next agent and easy hiring for the next human.

### 3. Draft the repo layout

Propose (in an info comment) a layout like:

```
/
├── apps/
│   ├── web/              # Next.js front-end
│   └── api/              # FastAPI backend
├── packages/
│   └── shared/           # Types & utils shared by web/api
├── infra/
│   └── terraform/        # Cloud infra as code
├── .github/
│   ├── agents/
│   ├── skills/
│   └── workflows/        # CI + deploy
├── .orchestrator/
│   ├── config.yaml
│   └── mcp-registry.yaml
└── docs/
    ├── README.md
    └── adr/              # Architecture decision records
```

Explain *why* for each top-level folder.

### 4. Decompose into skeleton issues — in order

Create sub-issues in this order. Each should be assignable to one agent
(spawn the specialist via `add-agent` if needed):

1. **Repo skeleton + toolchain** (`architect`): folders, package.json /
   pyproject.toml, lint, format, base configs. Merge before anything
   else.
2. **Database schema + migrations** (`database`): just `users` and one
   domain entity. Migration runner wired.
3. **Auth** (`backend` + `frontend`): one provider, login/logout/session.
4. **First CRUD slice** (`backend` + `frontend`): list, create, read
   one domain entity end-to-end.
5. **Tests** (`qa`): unit for the core logic, one integration test,
   one e2e happy path.
6. **CI workflow** (`devops`): lint, type-check, test on every PR.
7. **Preview environments** (`devops`): each PR gets a clickable URL.
8. **Staging deploy** (`devops`): automatic on merge to main.
9. **Production deploy** (`devops`): manual approval via environment.
10. **Observability** (`sre`): error tracking, one dashboard, one
    alert on uptime.

After this skeleton lands, feature work can start as normal issues.

### 5. Flag what the founder must set up

Some things only the human can do. File one `request_human_approval`
at the end of planning with the consolidated list:

- Cloud account (AWS / GCP / etc.), billing contact.
- GitHub Environments (`staging`, `production`) with reviewers.
- GitHub Secrets (see `add-secrets`).
- DNS / custom domain.
- External services (Stripe account, SendGrid, etc.) if in scope.

### 6. Set a budget guardrail early

Even in v1, add a cost cap. If you spawn a `devops` agent, its first
task should include setting up a monthly budget alert. Surprise AWS
bills kill solo projects.

### 7. Write the first ADR

Document the stack choice and the trade-offs in `docs/adr/0001-stack.md`.
Future agents (and the founder) will ask "why Next.js and not X" — make
the answer easy to find.

## Anti-patterns to avoid

- **Scaffolding and feature work in the same PR.** Feature work blocks
  on review; scaffolding must land fast.
- **Picking a framework you've never used because it's trendy.** Boring
  wins.
- **Skipping the skeleton and going straight to the signature feature.**
  You'll pay for it in every subsequent PR.
- **Doing a "migration pass" from the first commit** (e.g. picking a
  build system that's novel). Ship with the default, migrate later if
  the default hurts.

## Related skills

- `add-agent` — spawn architect / devops / qa agents as needed
- `add-mcp-server` — you'll likely need AWS / Terraform registry entries
- `deploy` — wire the staging → production flow
- `software-development-best-practices` — the scaffold should already
  follow these from day one
