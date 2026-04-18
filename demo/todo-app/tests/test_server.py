from __future__ import annotations

import importlib.util
import json
import threading
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError
from urllib.request import Request, urlopen


SERVER_PATH = Path(__file__).resolve().parents[1] / "server.py"
SPEC = importlib.util.spec_from_file_location("todo_demo_server", SERVER_PATH)
SERVER = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(SERVER)


class TodoServerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.public_dir = self.root / "public"
        self.public_dir.mkdir(parents=True)
        (self.public_dir / "index.html").write_text(
            "<!doctype html><title>Todo Demo</title><h1>Hello</h1>",
            encoding="utf-8",
        )
        self.data_file = self.root / "data" / "todos.json"
        self.store = SERVER.TodoStore(self.data_file)
        self.server = SERVER.ThreadingHTTPServer(
            ("127.0.0.1", 0),
            SERVER.build_handler(self.store, self.public_dir),
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_address[1]}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)
        self.temporary_directory.cleanup()

    def request(
        self,
        method: str,
        path: str,
        payload: dict | None = None,
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict, bytes]:
        if payload is not None and body is not None:
            raise ValueError("Use either 'payload' or 'body', not both.")

        request_body = body
        request_headers = dict(headers or {})
        if payload is not None:
            request_body = json.dumps(payload).encode("utf-8")
            request_headers.setdefault("Content-Type", "application/json")

        request = Request(
            f"{self.base_url}{path}",
            data=request_body,
            headers=request_headers,
            method=method,
        )

        try:
            with urlopen(request) as response:
                return response.status, dict(response.headers.items()), response.read()
        except HTTPError as error:
            return error.code, dict(error.headers.items()), error.read()

    def request_json(self, method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
        status, _, body = self.request(method, path, payload)
        document = json.loads(body.decode("utf-8")) if body else {}
        return status, document

    def write_storage(self, payload: object) -> None:
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        self.data_file.write_text(json.dumps(payload), encoding="utf-8")

    def test_get_bootstraps_missing_data_file(self) -> None:
        status, payload = self.request_json("GET", "/api/todos")

        self.assertEqual(status, 200)
        self.assertEqual(payload, {"todos": []})
        self.assertTrue(self.data_file.exists())
        stored = json.loads(self.data_file.read_text(encoding="utf-8"))
        self.assertEqual(stored, [])

    def test_post_bootstraps_missing_data_file(self) -> None:
        status, created = self.request_json("POST", "/api/todos", {"title": "Write tests"})

        self.assertEqual(status, 201)
        self.assertEqual(created["title"], "Write tests")
        self.assertTrue(self.data_file.exists())
        stored = json.loads(self.data_file.read_text(encoding="utf-8"))
        self.assertEqual(stored, [created])

    def test_crud_round_trip_persists_updates(self) -> None:
        status, created = self.request_json("POST", "/api/todos", {"title": "Write tests"})
        self.assertEqual(status, 201)
        self.assertEqual(created["title"], "Write tests")
        self.assertFalse(created["completed"])

        todo_id = created["id"]

        status, updated = self.request_json(
            "PATCH",
            f"/api/todos/{todo_id}",
            {"title": "Ship demo", "completed": True},
        )
        self.assertEqual(status, 200)
        self.assertEqual(updated["title"], "Ship demo")
        self.assertTrue(updated["completed"])
        self.assertNotEqual(updated["updatedAt"], updated["createdAt"])

        stored = json.loads(self.data_file.read_text(encoding="utf-8"))
        self.assertEqual(stored, [updated])

        status, listed = self.request_json("GET", "/api/todos")
        self.assertEqual(status, 200)
        self.assertEqual(listed, {"todos": [updated]})

        status, _, body = self.request("DELETE", f"/api/todos/{todo_id}")
        self.assertEqual(status, 204)
        self.assertEqual(body, b"")

        status, final_payload = self.request_json("GET", "/api/todos")
        self.assertEqual(status, 200)
        self.assertEqual(final_payload, {"todos": []})

    def test_validation_errors_are_explicit(self) -> None:
        status, payload = self.request_json("POST", "/api/todos", {"title": "   "})
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"], "Field 'title' cannot be empty.")

        status, payload = self.request_json("PATCH", "/api/todos/missing", {"completed": True})
        self.assertEqual(status, 404)
        self.assertEqual(payload["error"], "Todo 'missing' was not found.")

        status, payload = self.request_json("POST", "/api/todos", {"title": "Valid"})
        todo_id = payload["id"]

        status, payload = self.request_json(
            "PATCH",
            f"/api/todos/{todo_id}",
            {"completed": 1},
        )
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"], "Field 'completed' must be a boolean.")

        status, payload = self.request_json("PATCH", f"/api/todos/{todo_id}", {})
        self.assertEqual(status, 400)
        self.assertIn("Provide at least one", payload["error"])

    def test_invalid_json_request_body_returns_400(self) -> None:
        status, _, body = self.request(
            "POST",
            "/api/todos",
            body=b"{",
            headers={"Content-Type": "application/json"},
        )
        payload = json.loads(body.decode("utf-8"))

        self.assertEqual(status, 400)
        self.assertEqual(payload["error"], "Request body must contain valid JSON.")

    def test_mutations_report_malformed_storage_as_json_errors(self) -> None:
        malformed_todos = [
            {
                "id": "todo-1",
                "title": 99,
                "completed": False,
                "createdAt": "2026-04-18T00:00:00Z",
                "updatedAt": "2026-04-18T00:00:00Z",
            }
        ]
        scenarios = [
            ("POST", "/api/todos", {"title": "Create todo"}),
            ("PATCH", "/api/todos/todo-1", {"completed": True}),
            ("DELETE", "/api/todos/todo-1", None),
        ]

        for method, path, payload in scenarios:
            with self.subTest(method=method):
                self.write_storage(malformed_todos)
                status, response = self.request_json(method, path, payload)

                self.assertEqual(status, 500)
                self.assertEqual(
                    response,
                    {"error": "Unable to load todo data: Field 'title' must be a string."},
                )

    def test_static_files_are_served_from_public_dir(self) -> None:
        (self.public_dir / "styles.css").write_text("body { color: #111; }", encoding="utf-8")

        status, headers, body = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn("text/html", headers["Content-Type"])
        self.assertIn(b"Todo Demo", body)

        status, headers, body = self.request("GET", "/styles.css")
        self.assertEqual(status, 200)
        self.assertIn("text/css", headers["Content-Type"])
        self.assertEqual(body, b"body { color: #111; }")

        status, _, _ = self.request("GET", "/../server.py")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
