# gitnative-AI-orchestrator-testing

## Todo demo backend

Run the local Todo API with `npm start`, and run the Node built-in test suite with `npm test`.

The backend serves JSON CRUD routes under `/api/todos`:

- `GET /api/todos` -> `200 { "todos": [...] }`
- `POST /api/todos` -> `201 { "todo": { ... } }`
- `PATCH /api/todos/:id` -> `200 { "todo": { ... } }`
- `DELETE /api/todos/:id` -> `204`
