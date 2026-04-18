#!/usr/bin/env python3
"""Dependency-light Todo demo server."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import tempfile
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit
from uuid import uuid4

MAX_TITLE_LENGTH = 120
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
DEFAULT_DATA_FILE = Path(__file__).with_name("data") / "todos.json"
DEFAULT_PUBLIC_DIR = Path(__file__).with_name("public")


class RequestValidationError(Exception):
    """Raised when a request body or path is invalid."""


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def require_json_object(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise RequestValidationError("Request body must be a JSON object.")
    return payload


def validate_title(value: Any) -> str:
    if not isinstance(value, str):
        raise RequestValidationError("Field 'title' must be a string.")

    title = value.strip()
    if not title:
        raise RequestValidationError("Field 'title' cannot be empty.")
    if len(title) > MAX_TITLE_LENGTH:
        raise RequestValidationError(
            f"Field 'title' must be {MAX_TITLE_LENGTH} characters or fewer."
        )
    return title


def validate_create_payload(payload: Any) -> dict[str, Any]:
    document = require_json_object(payload)
    allowed_keys = {"title"}
    unknown_keys = sorted(set(document) - allowed_keys)
    if unknown_keys:
        raise RequestValidationError(
            f"Unsupported fields for todo creation: {', '.join(unknown_keys)}."
        )
    if "title" not in document:
        raise RequestValidationError("Field 'title' is required.")
    return {"title": validate_title(document["title"])}


def validate_update_payload(payload: Any) -> dict[str, Any]:
    document = require_json_object(payload)
    allowed_keys = {"title", "completed"}
    unknown_keys = sorted(set(document) - allowed_keys)
    if unknown_keys:
        raise RequestValidationError(
            f"Unsupported fields for todo updates: {', '.join(unknown_keys)}."
        )
    if not document:
        raise RequestValidationError(
            "Provide at least one of 'title' or 'completed' to update a todo."
        )

    updates: dict[str, Any] = {}
    if "title" in document:
        updates["title"] = validate_title(document["title"])
    if "completed" in document:
        if type(document["completed"]) is not bool:
            raise RequestValidationError("Field 'completed' must be a boolean.")
        updates["completed"] = document["completed"]

    return updates


def validate_todo_item(item: Any) -> dict[str, Any]:
    try:
        todo = require_json_object(item)
        required_keys = {"id", "title", "completed", "createdAt", "updatedAt"}
        if set(todo) != required_keys:
            raise ValueError("Todo items in storage must match the expected contract.")
        if not isinstance(todo["id"], str) or not todo["id"]:
            raise ValueError("Todo 'id' values must be non-empty strings.")
        if type(todo["completed"]) is not bool:
            raise ValueError("Todo 'completed' values must be booleans.")
        title = validate_title(todo["title"])
    except RequestValidationError as error:
        raise ValueError(str(error)) from error

    return {
        "id": todo["id"],
        "title": title,
        "completed": todo["completed"],
        "createdAt": str(todo["createdAt"]),
        "updatedAt": str(todo["updatedAt"]),
    }


class TodoStore:
    """File-backed Todo persistence with atomic writes."""

    def __init__(self, data_file: Path) -> None:
        self.data_file = data_file
        self._lock = threading.Lock()

    def _bootstrap_if_needed(self) -> None:
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.data_file.exists():
            self._write_locked([])

    def _read_locked(self) -> list[dict[str, Any]]:
        with self.data_file.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if not isinstance(payload, list):
            raise ValueError("Todo storage must contain a JSON array.")
        return [validate_todo_item(item) for item in payload]

    def _write_locked(self, todos: list[dict[str, Any]]) -> None:
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        file_descriptor, temporary_path = tempfile.mkstemp(
            dir=str(self.data_file.parent),
            prefix=f"{self.data_file.name}.",
            suffix=".tmp",
        )
        try:
            with os.fdopen(file_descriptor, "w", encoding="utf-8") as handle:
                json.dump(todos, handle, indent=2)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_path, self.data_file)
        except Exception:
            if os.path.exists(temporary_path):
                os.unlink(temporary_path)
            raise

    def list_todos(self) -> list[dict[str, Any]]:
        with self._lock:
            self._bootstrap_if_needed()
            return self._read_locked()

    def create_todo(self, title: str) -> dict[str, Any]:
        with self._lock:
            self._bootstrap_if_needed()
            todos = self._read_locked()
            timestamp = utc_now_iso()
            todo = {
                "id": uuid4().hex,
                "title": title,
                "completed": False,
                "createdAt": timestamp,
                "updatedAt": timestamp,
            }
            todos.append(todo)
            self._write_locked(todos)
            return todo

    def update_todo(self, todo_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self._bootstrap_if_needed()
            todos = self._read_locked()
            for index, todo in enumerate(todos):
                if todo["id"] != todo_id:
                    continue

                updated = dict(todo)
                updated.update(updates)
                updated["updatedAt"] = utc_now_iso()
                todos[index] = updated
                self._write_locked(todos)
                return updated

        raise KeyError(todo_id)

    def delete_todo(self, todo_id: str) -> None:
        with self._lock:
            self._bootstrap_if_needed()
            todos = self._read_locked()
            remaining = [todo for todo in todos if todo["id"] != todo_id]
            if len(remaining) == len(todos):
                raise KeyError(todo_id)
            self._write_locked(remaining)


def parse_todo_id(path: str) -> str | None:
    if not path.startswith("/api/todos/"):
        return None
    todo_id = path.removeprefix("/api/todos/")
    if not todo_id or "/" in todo_id:
        return None
    return unquote(todo_id)


def build_handler(
    store: TodoStore,
    public_dir: Path,
) -> type[BaseHTTPRequestHandler]:
    class TodoRequestHandler(BaseHTTPRequestHandler):
        server_version = "TodoDemo/1.0"

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlsplit(self.path)
            if parsed.path == "/api/todos":
                self._handle_list_todos()
                return
            if parsed.path.startswith("/api/"):
                self._send_api_error(HTTPStatus.NOT_FOUND, "API route not found.")
                return
            self._serve_static(parsed.path)

        def do_POST(self) -> None:  # noqa: N802
            parsed = urlsplit(self.path)
            if parsed.path != "/api/todos":
                self._send_api_error(HTTPStatus.NOT_FOUND, "API route not found.")
                return

            try:
                payload = self._read_json_body()
                todo = store.create_todo(validate_create_payload(payload)["title"])
            except RequestValidationError as error:
                self._send_api_error(HTTPStatus.BAD_REQUEST, str(error))
                return
            except ValueError as error:
                self._handle_storage_load_error(error)
                return
            except OSError as error:
                self._handle_storage_write_error(error)
                return

            self._send_json(HTTPStatus.CREATED, todo)

        def do_PATCH(self) -> None:  # noqa: N802
            parsed = urlsplit(self.path)
            todo_id = parse_todo_id(parsed.path)
            if todo_id is None:
                self._send_api_error(HTTPStatus.NOT_FOUND, "Todo route not found.")
                return

            try:
                payload = self._read_json_body()
                todo = store.update_todo(todo_id, validate_update_payload(payload))
            except RequestValidationError as error:
                self._send_api_error(HTTPStatus.BAD_REQUEST, str(error))
                return
            except KeyError:
                self._send_api_error(HTTPStatus.NOT_FOUND, f"Todo '{todo_id}' was not found.")
                return
            except ValueError as error:
                self._handle_storage_load_error(error)
                return
            except OSError as error:
                self._handle_storage_write_error(error)
                return

            self._send_json(HTTPStatus.OK, todo)

        def do_DELETE(self) -> None:  # noqa: N802
            parsed = urlsplit(self.path)
            todo_id = parse_todo_id(parsed.path)
            if todo_id is None:
                self._send_api_error(HTTPStatus.NOT_FOUND, "Todo route not found.")
                return

            try:
                store.delete_todo(todo_id)
            except KeyError:
                self._send_api_error(HTTPStatus.NOT_FOUND, f"Todo '{todo_id}' was not found.")
                return
            except ValueError as error:
                self._handle_storage_load_error(error)
                return
            except OSError as error:
                self._handle_storage_write_error(error)
                return

            self.send_response(HTTPStatus.NO_CONTENT)
            self.end_headers()

        def _handle_list_todos(self) -> None:
            try:
                todos = store.list_todos()
            except (OSError, ValueError) as error:
                self._handle_storage_load_error(error)
                return

            self._send_json(HTTPStatus.OK, {"todos": todos})

        def _read_json_body(self) -> Any:
            raw_length = self.headers.get("Content-Length")
            if raw_length is None:
                raise RequestValidationError("Requests with a body must send Content-Length.")

            try:
                content_length = int(raw_length)
            except ValueError as error:
                raise RequestValidationError("Content-Length must be a valid integer.") from error

            if content_length <= 0:
                raise RequestValidationError("Request body cannot be empty.")

            body = self.rfile.read(content_length)
            try:
                text = body.decode("utf-8")
            except UnicodeDecodeError as error:
                raise RequestValidationError("Request bodies must be valid UTF-8.") from error

            try:
                return json.loads(text)
            except json.JSONDecodeError as error:
                raise RequestValidationError("Request body must contain valid JSON.") from error

        def _serve_static(self, request_path: str) -> None:
            candidate = self._resolve_public_path(request_path)
            if candidate is None or not candidate.is_file():
                self.send_error(HTTPStatus.NOT_FOUND, "File not found.")
                return

            content_type, _ = mimetypes.guess_type(candidate.name)
            with candidate.open("rb") as handle:
                content = handle.read()

            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type or "application/octet-stream")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        def _resolve_public_path(self, request_path: str) -> Path | None:
            relative_path = request_path.lstrip("/")
            if not relative_path:
                relative_path = "index.html"

            resolved = (public_dir / relative_path).resolve()
            public_root = public_dir.resolve()
            if resolved != public_root and public_root not in resolved.parents:
                return None
            if resolved.is_dir():
                resolved = (resolved / "index.html").resolve()
                if resolved != public_root and public_root not in resolved.parents:
                    return None
            return resolved

        def _send_json(self, status: HTTPStatus, payload: Any) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _send_api_error(self, status: HTTPStatus, message: str) -> None:
            self._send_json(status, {"error": message})

        def _handle_storage_load_error(self, error: Exception) -> None:
            self._send_api_error(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                f"Unable to load todo data: {error}",
            )

        def _handle_storage_write_error(self, error: OSError) -> None:
            self._send_api_error(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                f"Unable to persist todo data: {error}",
            )

        def log_message(self, format: str, *args: Any) -> None:
            return

    return TodoRequestHandler


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the Todo demo API and static assets.")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Interface to bind to.")
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help="Port to bind to.",
    )
    parser.add_argument(
        "--data-file",
        type=Path,
        default=DEFAULT_DATA_FILE,
        help="Path to the JSON file used for Todo persistence.",
    )
    parser.add_argument(
        "--public-dir",
        type=Path,
        default=DEFAULT_PUBLIC_DIR,
        help="Directory containing static UI assets.",
    )
    return parser.parse_args()


def run_server(host: str, port: int, data_file: Path, public_dir: Path) -> None:
    store = TodoStore(data_file)
    public_dir.mkdir(parents=True, exist_ok=True)
    with ThreadingHTTPServer((host, port), build_handler(store, public_dir)) as server:
        bound_host, bound_port = server.server_address[:2]
        print(
            f"Todo demo available at http://{bound_host}:{bound_port} "
            f"(data: {data_file}, public: {public_dir})"
        )
        server.serve_forever()


def main() -> None:
    arguments = parse_arguments()
    run_server(
        host=arguments.host,
        port=arguments.port,
        data_file=arguments.data_file,
        public_dir=arguments.public_dir,
    )


if __name__ == "__main__":
    main()
