# Todo Demo

This directory is the repository's demo workload: a small Todo application used to exercise the orchestrator against a realistic multi-surface change set.

It is intentionally separate from the repository's orchestrator scaffold:

- Use [`../../SETUP.md`](../../SETUP.md) when configuring orchestration for a repository.
- Use this README when running, testing, or inspecting the Todo demo itself.

## What the demo is for

The Todo demo gives contributors a compact app that is easy to run locally and easy for the orchestrator to modify across backend, frontend, test, and documentation surfaces.

The MVP keeps the stack intentionally small:

- one Node.js server process
- plain HTML, CSS, and JavaScript in the browser
- file-backed JSON persistence for local/demo usage
- Node's built-in test runner for automated coverage
- a dedicated CI workflow for demo validation under `.github/workflows/todo-demo.yml`

## File and folder layout

```text
demo/todo-app/
  README.md
  package.json
  server.js
  src/
    todo-routes.js
    todo-store.js
  public/
    app.js
    index.html
    styles.css
  test/
    todo-api.test.js
    todo-store.test.js
```

Runtime data is stored in a local JSON file managed by the store layer. Treat that storage as demo-only state, not durable application infrastructure.

## Setup

1. Install a current Node.js LTS release.
2. From the repository root, change into the demo directory:
   ```bash
   cd demo/todo-app
   ```
3. Install dependencies if the package manifest ever gains any:
   ```bash
   npm install
   ```

The MVP is designed to rely on built-in Node.js modules, so `npm install` should be fast and may be a no-op beyond script support.

## Run locally

From `demo/todo-app/`:

```bash
npm start
```

If you want to bypass package scripts, run the server directly:

```bash
node server.js
```

The server hosts both the browser UI and the JSON API. After startup, open the local URL printed by the server (typically `http://localhost:3000`).

## Run tests

From `demo/todo-app/`:

```bash
npm test
```

The direct Node test-runner equivalent is:

```bash
node --test
```

The isolated CI workflow for the demo lives in `../../.github/workflows/todo-demo.yml` so app validation stays separate from the orchestrator automation workflow.

## Architecture summary

The MVP is intentionally split into a few clear boundaries:

| Surface | Responsibility |
|---|---|
| `server.js` | Starts the HTTP server, serves static assets, and mounts the Todo API |
| `src/todo-routes.js` | Parses requests, validates input, and implements the `/api/todos` contract |
| `src/todo-store.js` | Handles CRUD operations and JSON-file persistence |
| `public/` | Browser UI for create/list/update/delete flows |
| `test/` | Store and API coverage for happy paths and failure cases |

This keeps the demo readable while still giving the orchestrator multiple connected surfaces to reason about.

## API summary

Base path: `/api/todos`

| Method | Path | Purpose | Request body |
|---|---|---|---|
| `GET` | `/api/todos` | List all todos | none |
| `POST` | `/api/todos` | Create a todo | `{ "title": "string" }` |
| `PATCH` | `/api/todos/:id` | Update title and/or completion | `{ "title"?: "string", "completed"?: boolean }` |
| `DELETE` | `/api/todos/:id` | Delete a todo | none |

Todo items use this MVP shape:

```json
{
  "id": "string",
  "title": "string",
  "completed": false,
  "createdAt": "ISO-8601"
}
```

Validation errors should return explicit non-2xx responses rather than silently accepting bad input.

## MVP limitations

This demo is intentionally lightweight. Known limitations include:

- file-backed persistence is suitable for local/demo use only
- no authentication, authorization, or multi-user behavior
- no concurrency guarantees beyond a single local process
- no database migrations, background jobs, or production hardening
- plain JavaScript/HTML/CSS only; no framework, bundler, or client-side routing

If you are working on the orchestrator platform itself, stay in the top-level scaffold docs. If you are using the Todo app as the example workload, stay in this directory's docs and scripts.
