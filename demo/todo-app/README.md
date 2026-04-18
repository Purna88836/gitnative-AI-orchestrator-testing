# Todo Demo

This directory contains the repository's example workload: a small full-stack Todo app used to exercise orchestrated changes across backend, frontend, QA, and docs surfaces.

It is intentionally separate from the repository's orchestrator scaffold:

- Use [../../SETUP.md](../../SETUP.md) when configuring orchestration for another repository.
- Use this README when running, testing, or modifying the Todo demo itself.

## Architecture at a glance

The MVP stays dependency-light because this repository does not have an existing application stack to extend.

- `server.py` serves both static files and the JSON API using Python's standard library.
- `public/` contains plain HTML, CSS, and JavaScript with no bundler.
- `data/` stores demo-only JSON state; mutations rewrite the file atomically.
- `tests/` uses Python's built-in `unittest` tooling.
- `.github/workflows/todo-demo.yml` runs isolated demo validation without touching `.github/workflows/orchestrator.yml`.

## Layout

```text
demo/todo-app/
  README.md
  server.py
  public/
    index.html
    app.js
    styles.css
  data/
    .gitignore
    todos.json
  tests/
    test_server.py
    test_ui_integration.py
```

## Run locally

Use a current Python 3 interpreter.

From the repository root:

```bash
cd demo/todo-app
python server.py
```

The single server process hosts both the browser UI and the `/api/todos` endpoints. Open the local URL printed at startup in your browser.

## Run tests

From the repository root:

```bash
python -m unittest discover -s demo/todo-app/tests -v
```

The dedicated GitHub Actions workflow runs the same command so Todo validation stays separate from orchestrator automation.

## API contract

Base path: `/api/todos`

| Method | Path | Purpose | Request body |
| --- | --- | --- | --- |
| `GET` | `/api/todos` | List all todos | none |
| `POST` | `/api/todos` | Create a todo | `{ "title": "string" }` |
| `PATCH` | `/api/todos/{id}` | Update title and/or completion | `{ "title"?: "string", "completed"?: boolean }` |
| `DELETE` | `/api/todos/{id}` | Delete a todo | none |

Todo items use this MVP shape:

```json
{
  "id": "string",
  "title": "string",
  "completed": false,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

Validation errors return explicit 4xx JSON responses instead of silently accepting bad input.

## Validation scope and current gaps

- `tests/test_server.py` covers CRUD behavior, validation errors, missing-data bootstrap behavior, malformed storage handling, and static asset serving.
- `tests/test_ui_integration.py` serves the checked-in HTML/CSS/JS from a live server and verifies that the frontend asset wiring matches the live `/api/todos` contract.
- Browser-level automation is intentionally omitted. Keeping QA stdlib-only avoids introducing headless-browser dependencies into this repo, but it means DOM/runtime behavior in a real browser still depends on manual spot checks if a UI regression is suspected.

## Storage behavior

- The JSON store lives under `demo/todo-app/data/`.
- If the data file does not exist yet, the server bootstraps an empty todo list.
- Each create, update, or delete operation rewrites the file atomically to reduce corruption risk.
- This storage is for local/demo use only, not durable multi-user infrastructure.

## Why the demo is isolated

This repository is primarily an orchestrator example, not an application repository. Keeping the Todo app inside `demo/todo-app/` avoids coupling app-specific runtime, test, and CI changes to the core scaffold while still providing a realistic end-to-end workload for the agents to coordinate.
