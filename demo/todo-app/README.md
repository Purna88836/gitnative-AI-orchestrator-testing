# Todo Demo

This directory documents the Todo demo planned in issue [#36](../../issues/36). It is the repository's example workload: a small full-stack app used to exercise orchestrated changes across backend, frontend, QA, and docs surfaces.

It is intentionally separate from the repository's orchestrator scaffold:

- Use [../../SETUP.md](../../SETUP.md) when configuring orchestration for a repository.
- Use this README when running, testing, or modifying the Todo demo itself.

## Architecture at a glance

The MVP stays dependency-light because this repository does not have an existing application stack to extend.

- `server.py` serves both static files and the JSON API using Python's standard library.
- `public/` contains plain HTML, CSS, and JavaScript with no bundler.
- `data/` stores demo-only JSON state; mutations should rewrite the file atomically.
- `tests/` uses Python's built-in `unittest` tooling.
- `.github/workflows/todo-demo.yml` is the planned isolated CI entry point for the demo.

## Planned layout

```text
demo/todo-app/
  README.md
  server.py
  public/
    index.html
    app.js
    styles.css
  data/
    todos.json
  tests/
    test_server.py
```

## Run locally

Use a current Python 3 interpreter.

From the repository root:

```bash
cd demo/todo-app
python server.py
```

The single server process should host both the browser UI and the `/api/todos` endpoints. Open the local URL printed at startup in your browser.

## Run tests

From the repository root:

```bash
python -m unittest discover -s demo/todo-app/tests -v
```

The planned CI workflow should run the same demo-focused validation so Todo checks stay separate from `.github/workflows/orchestrator.yml`.

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

Validation errors should return explicit 4xx responses rather than silently accepting bad input.

## Storage behavior

- The JSON store lives under `demo/todo-app/data/`.
- If the data file does not exist yet, the server should bootstrap an empty todo list.
- Each create, update, or delete operation should rewrite the file atomically to reduce corruption risk.
- This storage is for local/demo use only, not durable multi-user infrastructure.

## Why the demo is isolated

This repository is primarily an orchestrator example, not an application repository. Keeping the Todo app inside `demo/todo-app/` avoids coupling app-specific runtime, test, and CI changes to the core scaffold while still providing a realistic end-to-end workload for the agents to coordinate.
