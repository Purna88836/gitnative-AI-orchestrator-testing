from __future__ import annotations

import importlib.util
import json
import shutil
import threading
import unittest
from html.parser import HTMLParser
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError
from urllib.request import Request, urlopen


APP_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FIXTURES = APP_ROOT / "public"
SERVER_PATH = APP_ROOT / "server.py"
SPEC = importlib.util.spec_from_file_location("todo_demo_server", SERVER_PATH)
SERVER = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(SERVER)

REQUIRED_HTML_IDS = {
    "todo-form",
    "todo-title",
    "add-button",
    "refresh-button",
    "status-message",
    "error-message",
    "loading-state",
    "empty-state",
    "todo-list",
    "todo-item-template",
}
REQUIRED_JS_SELECTORS = [
    '#todo-form',
    '#todo-title',
    '#add-button',
    '#refresh-button',
    '#status-message',
    '#error-message',
    '#loading-state',
    '#empty-state',
    '#todo-list',
    '#todo-item-template',
]


class TodoShellParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.scripts: list[str] = []
        self.stylesheets: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        element_id = attributes.get("id")
        if element_id:
            self.ids.add(element_id)
        if tag == "script" and attributes.get("src"):
            self.scripts.append(attributes["src"])
        if tag == "link" and attributes.get("rel") == "stylesheet" and attributes.get("href"):
            self.stylesheets.append(attributes["href"])


class TodoUiIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.public_dir = self.root / "public"
        self.public_dir.mkdir(parents=True)
        for asset_name in ("index.html", "app.js", "styles.css"):
            shutil.copyfile(PUBLIC_FIXTURES / asset_name, self.public_dir / asset_name)

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
    ) -> tuple[int, dict[str, str], bytes]:
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

    def test_root_serves_checked_in_frontend_assets(self) -> None:
        status, headers, body = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn("text/html", headers["Content-Type"])

        parser = TodoShellParser()
        parser.feed(body.decode("utf-8"))
        self.assertTrue(REQUIRED_HTML_IDS.issubset(parser.ids))
        self.assertIn("./app.js", parser.scripts)
        self.assertIn("./styles.css", parser.stylesheets)

        status, headers, app_js = self.request("GET", "/app.js")
        self.assertEqual(status, 200)
        self.assertIn("javascript", headers["Content-Type"])
        self.assertEqual(app_js, (PUBLIC_FIXTURES / "app.js").read_bytes())

        status, headers, styles_css = self.request("GET", "/styles.css")
        self.assertEqual(status, 200)
        self.assertIn("text/css", headers["Content-Type"])
        self.assertEqual(styles_css, (PUBLIC_FIXTURES / "styles.css").read_bytes())

    def test_live_api_contract_matches_frontend_expectations(self) -> None:
        status, _, app_js = self.request("GET", "/app.js")
        self.assertEqual(status, 200)
        app_script = app_js.decode("utf-8")

        for selector in REQUIRED_JS_SELECTORS:
            self.assertIn(f'document.querySelector("{selector}")', app_script)
        self.assertIn('request("/api/todos")', app_script)
        self.assertIn('request(`/api/todos/${encodeURIComponent(todo.id)}`', app_script)
        self.assertIn('Array.isArray(payload.todos)', app_script)
        self.assertIn('typeof payload.error === "string"', app_script)

        status, listed = self.request_json("GET", "/api/todos")
        self.assertEqual(status, 200)
        self.assertEqual(listed, {"todos": []})

        status, created = self.request_json("POST", "/api/todos", {"title": "Wire UI to API"})
        self.assertEqual(status, 201)
        self.assertEqual(created["title"], "Wire UI to API")
        self.assertFalse(created["completed"])
        for key in ("id", "createdAt", "updatedAt"):
            self.assertIn(key, created)

        status, listed = self.request_json("GET", "/api/todos")
        self.assertEqual(status, 200)
        self.assertEqual(listed, {"todos": [created]})

        status, updated = self.request_json(
            "PATCH",
            f"/api/todos/{created['id']}",
            {"completed": True, "title": "Wire UI to API"},
        )
        self.assertEqual(status, 200)
        self.assertTrue(updated["completed"])

        status, _, body = self.request("DELETE", f"/api/todos/{created['id']}")
        self.assertEqual(status, 204)
        self.assertEqual(body, b"")

        status, listed = self.request_json("GET", "/api/todos")
        self.assertEqual(status, 200)
        self.assertEqual(listed, {"todos": []})


if __name__ == "__main__":
    unittest.main()
