const state = {
  todos: [],
  loading: true,
  message: "Loading todos...",
  messageType: "info",
  creating: false,
  pendingIds: new Set(),
  editingId: null,
  editDraft: "",
};

const elements = {
  banner: document.querySelector("#banner"),
  content: document.querySelector("#content"),
  createButton: document.querySelector("#create-button"),
  createForm: document.querySelector("#create-form"),
  summary: document.querySelector("#summary"),
  titleInput: document.querySelector("#todo-title"),
};

elements.createForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = elements.titleInput.value.trim();
  if (!title) {
    showMessage("Enter a title before creating a todo.", "error");
    elements.titleInput.focus();
    return;
  }

  setCreating(true);

  try {
    const payload = await requestJson("/api/todos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });

    const createdTodo = extractTodo(payload);

    if (createdTodo) {
      state.todos = sortTodos([
        createdTodo,
        ...state.todos.filter((todo) => todo.id !== createdTodo.id),
      ]);
    } else {
      await loadTodos();
    }

    elements.createForm.reset();
    showMessage("Todo created.", "info");
    render();
  } catch (error) {
    showMessage(getErrorMessage(error, "Unable to create the todo."), "error");
    render();
  } finally {
    setCreating(false);
  }
});

elements.content.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const deleteButton = target.closest("[data-action='delete']");
  if (deleteButton) {
    const { id } = deleteButton.dataset;
    if (id) {
      await deleteTodo(id);
    }
    return;
  }

  const editButton = target.closest("[data-action='edit']");
  if (editButton) {
    const { id } = editButton.dataset;
    if (id) {
      const todo = state.todos.find((item) => item.id === id);
      state.editingId = id;
      state.editDraft = todo ? todo.title : "";
      render();

      const input = elements.content.querySelector("[data-edit-input='true']");
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    }
    return;
  }

  const cancelButton = target.closest("[data-action='cancel-edit']");
  if (cancelButton) {
    resetEditing();
    render();
  }
});

elements.content.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.matches("[data-role='toggle']")) {
    const id = target.dataset.id;
    if (id) {
      await updateTodo(id, { completed: target.checked }, "Todo updated.");
    }
  }
});

elements.content.addEventListener("input", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.matches("[data-edit-input='true']")) {
    state.editDraft = target.value;
  }
});

elements.content.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.dataset.role !== "edit-form") {
    return;
  }

  event.preventDefault();
  const id = form.dataset.id;
  if (!id) {
    return;
  }

  const title = state.editDraft.trim();
  if (!title) {
    showMessage("Todo titles cannot be empty.", "error");
    const input = form.querySelector("input");
    if (input instanceof HTMLInputElement) {
      input.focus();
    }
    return;
  }

  const todo = state.todos.find((item) => item.id === id);
  if (todo && todo.title === title) {
    resetEditing();
    render();
    return;
  }

  const didUpdate = await updateTodo(id, { title }, "Todo title saved.");
  if (didUpdate) {
    resetEditing();
    render();
  }
});

void loadTodos();

async function loadTodos() {
  state.loading = true;
  showMessage("Loading todos...", "info");
  render();

  try {
    const payload = await requestJson("/api/todos");
    state.todos = sortTodos(extractTodos(payload));
    state.loading = false;

    showMessage("", "info");

    render();
  } catch (error) {
    state.loading = false;
    state.todos = [];
    showMessage(getErrorMessage(error, "Unable to load todos."), "error");
    render();
  }
}

async function updateTodo(id, updates, successMessage) {
  setPending(id, true);

  try {
    const payload = await requestJson(`/api/todos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    const updatedTodo = extractTodo(payload);
    if (updatedTodo) {
      state.todos = sortTodos(
        state.todos.map((todo) => (todo.id === id ? updatedTodo : todo))
      );
    } else {
      state.todos = sortTodos(
        state.todos.map((todo) =>
          todo.id === id
            ? { ...todo, ...updates, updatedAt: new Date().toISOString() }
            : todo
        )
      );
    }

    showMessage(successMessage, "info");
    return true;
  } catch (error) {
    showMessage(getErrorMessage(error, "Unable to update the todo."), "error");
    return false;
  } finally {
    setPending(id, false);
    render();
  }
}

async function deleteTodo(id) {
  const todo = state.todos.find((item) => item.id === id);
  const shouldDelete = window.confirm(`Delete "${todo ? todo.title : "this todo"}"?`);

  if (!shouldDelete) {
    return;
  }

  setPending(id, true);

  try {
    await requestJson(`/api/todos/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    state.todos = state.todos.filter((item) => item.id !== id);
    if (state.editingId === id) {
      resetEditing();
    }

    showMessage("Todo deleted.", "info");
  } catch (error) {
    showMessage(getErrorMessage(error, "Unable to delete the todo."), "error");
  } finally {
    setPending(id, false);
    render();
  }
}

function render() {
  renderSummary();
  renderBanner();

  if (state.loading) {
    elements.content.innerHTML = '<div class="empty-state">Loading todos...</div>';
    return;
  }

  if (state.todos.length === 0) {
    elements.content.innerHTML =
      '<div class="empty-state"><p>No todos yet.</p><p>Add one above to start the demo flow.</p></div>';
    return;
  }

  const markup = state.todos
    .map((todo) => {
      const isPending = state.pendingIds.has(todo.id);
      const isEditing = state.editingId === todo.id;
      const updatedLabel = todo.updatedAt
        ? `Updated ${formatTimestamp(todo.updatedAt)}`
        : "Saved";

      if (isEditing) {
        return `
          <li class="todo-item" data-id="${escapeHtml(todo.id)}">
            <input
              class="todo-toggle"
              type="checkbox"
              data-role="toggle"
              data-id="${escapeHtml(todo.id)}"
              ${todo.completed ? "checked" : ""}
              ${isPending ? "disabled" : ""}
              aria-label="Toggle todo completion"
            />
            <div class="todo-main">
              <form class="todo-edit-form" data-role="edit-form" data-id="${escapeHtml(todo.id)}">
                <label class="sr-only" for="edit-${escapeHtml(todo.id)}">Edit todo title</label>
                <input
                  id="edit-${escapeHtml(todo.id)}"
                  class="todo-edit-input"
                  type="text"
                  maxlength="160"
                  value="${escapeHtml(state.editDraft)}"
                  data-edit-input="true"
                  ${isPending ? "disabled" : ""}
                  required
                />
                <div class="todo-edit-actions">
                  <button class="button-secondary" type="submit" ${isPending ? "disabled" : ""}>Save</button>
                  <button
                    class="button-secondary"
                    type="button"
                    data-action="cancel-edit"
                    data-id="${escapeHtml(todo.id)}"
                    ${isPending ? "disabled" : ""}
                  >
                    Cancel
                  </button>
                </div>
              </form>
              <p class="todo-meta">${escapeHtml(updatedLabel)}</p>
            </div>
          </li>
        `;
      }

      return `
        <li class="todo-item" data-id="${escapeHtml(todo.id)}">
          <input
            class="todo-toggle"
            type="checkbox"
            data-role="toggle"
            data-id="${escapeHtml(todo.id)}"
            ${todo.completed ? "checked" : ""}
            ${isPending ? "disabled" : ""}
            aria-label="Toggle todo completion"
          />
          <div class="todo-main">
            <p class="todo-title ${todo.completed ? "completed" : ""}">${escapeHtml(todo.title)}</p>
            <p class="todo-meta">${escapeHtml(updatedLabel)}</p>
          </div>
          <div class="todo-actions">
            <button
              class="button-secondary"
              type="button"
              data-action="edit"
              data-id="${escapeHtml(todo.id)}"
              ${isPending ? "disabled" : ""}
            >
              Edit
            </button>
            <button
              class="button-danger"
              type="button"
              data-action="delete"
              data-id="${escapeHtml(todo.id)}"
              ${isPending ? "disabled" : ""}
            >
              Delete
            </button>
          </div>
        </li>
      `;
    })
    .join("");

  elements.content.innerHTML = `<ul class="todo-list">${markup}</ul>`;
}

function renderBanner() {
  if (!state.message) {
    elements.banner.textContent = "";
    elements.banner.className = "banner hidden";
    return;
  }

  elements.banner.textContent = state.message;
  elements.banner.className = `banner ${state.messageType}`;
}

function renderSummary() {
  if (state.loading) {
    elements.summary.textContent = "Loading todos...";
    return;
  }

  const total = state.todos.length;
  const remaining = state.todos.filter((todo) => !todo.completed).length;
  const noun = total === 1 ? "todo" : "todos";
  const remainingNoun = remaining === 1 ? "item" : "items";

  elements.summary.textContent =
    total === 0
      ? "No todos yet."
      : `${total} ${noun} total, ${remaining} ${remainingNoun} remaining.`;
}

function setCreating(isCreating) {
  state.creating = isCreating;
  elements.createButton.disabled = isCreating;
  elements.titleInput.disabled = isCreating;
}

function setPending(id, isPending) {
  if (isPending) {
    state.pendingIds.add(id);
  } else {
    state.pendingIds.delete(id);
  }
}

function resetEditing() {
  state.editingId = null;
  state.editDraft = "";
}

function showMessage(message, type) {
  state.message = message;
  state.messageType = type;
  renderBanner();
}

async function requestJson(url, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  const payload = parsePayload(text);

  if (!response.ok) {
    const message =
      extractError(payload) ||
      `${response.status} ${response.statusText}`.trim() ||
      "Request failed.";
    throw new Error(message);
  }

  return payload;
}

function parsePayload(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractTodos(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.todos)) {
    return payload.todos;
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

function extractTodo(payload) {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return null;
  }

  if (payload.id && typeof payload.title === "string") {
    return payload;
  }

  if (payload.todo && typeof payload.todo === "object") {
    return payload.todo;
  }

  if (payload.data && typeof payload.data === "object") {
    return payload.data;
  }

  return null;
}

function extractError(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return null;
}

function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function sortTodos(todos) {
  return [...todos].sort((left, right) => {
    if (left.completed !== right.completed) {
      return Number(left.completed) - Number(right.completed);
    }

    const leftTime = left.updatedAt || left.createdAt || "";
    const rightTime = right.updatedAt || right.createdAt || "";
    return rightTime.localeCompare(leftTime);
  });
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
