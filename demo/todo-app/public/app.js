(function () {
  const state = {
    todos: [],
    loading: false,
    error: "",
    status: "",
    editingId: null,
    pendingIds: new Set(),
    creating: false,
  };

  const elements = {
    createForm: document.querySelector("#create-form"),
    createButton: document.querySelector("#create-button"),
    newTodoTitle: document.querySelector("#new-todo-title"),
    errorBanner: document.querySelector("#error-banner"),
    statusBanner: document.querySelector("#status-banner"),
    loadingState: document.querySelector("#loading-state"),
    emptyState: document.querySelector("#empty-state"),
    todoList: document.querySelector("#todo-list"),
    itemTemplate: document.querySelector("#todo-item-template"),
  };

  function setError(message) {
    state.error = message;
    render();
  }

  function setStatus(message) {
    state.status = message;
    render();
  }

  function clearMessages() {
    state.error = "";
    state.status = "";
  }

  async function parseJson(response) {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error("The server returned invalid JSON.");
    }
  }

  async function request(path, options) {
    const response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });
    const data = await parseJson(response);

    if (!response.ok) {
      const message =
        data && typeof data.error === "string"
          ? data.error
          : "The request failed. Please try again.";
      throw new Error(message);
    }

    return data;
  }

  function normalizeTodoList(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && Array.isArray(payload.todos)) {
      return payload.todos;
    }

    throw new Error("The server returned an unexpected todo list shape.");
  }

  function normalizeTitle(value) {
    return value.trim();
  }

  async function loadTodos() {
    state.loading = true;
    state.error = "";
    render();

    try {
      const payload = await request("/api/todos", { method: "GET" });
      state.todos = normalizeTodoList(payload);
    } catch (error) {
      state.todos = [];
      setError(error.message);
    } finally {
      state.loading = false;
      render();
    }
  }

  async function createTodo(title) {
    state.creating = true;
    clearMessages();
    render();

    try {
      await request("/api/todos", {
        method: "POST",
        body: JSON.stringify({ title }),
      });

      elements.createForm.reset();
      await loadTodos();
      setStatus("Todo created.");
    } catch (error) {
      setError(error.message);
    } finally {
      state.creating = false;
      render();
    }
  }

  async function updateTodo(id, updates, successMessage) {
    state.pendingIds.add(id);
    clearMessages();
    render();

    try {
      await request("/api/todos/" + encodeURIComponent(id), {
        method: "PATCH",
        body: JSON.stringify(updates),
      });

      state.editingId = null;
      await loadTodos();
      setStatus(successMessage);
    } catch (error) {
      setError(error.message);
    } finally {
      state.pendingIds.delete(id);
      render();
    }
  }

  async function deleteTodo(id) {
    state.pendingIds.add(id);
    clearMessages();
    render();

    try {
      await request("/api/todos/" + encodeURIComponent(id), {
        method: "DELETE",
      });

      if (state.editingId === id) {
        state.editingId = null;
      }

      await loadTodos();
      setStatus("Todo deleted.");
    } catch (error) {
      setError(error.message);
    } finally {
      state.pendingIds.delete(id);
      render();
    }
  }

  function setBusy(element, busy) {
    element.disabled = busy;
  }

  function renderMessages() {
    elements.errorBanner.hidden = !state.error;
    elements.errorBanner.textContent = state.error;

    elements.statusBanner.hidden = !state.status;
    elements.statusBanner.textContent = state.status;
  }

  function renderTodoItem(todo) {
    const fragment = elements.itemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".todo-item");
    const checkbox = fragment.querySelector(".todo-complete");
    const title = fragment.querySelector(".todo-title");
    const editButton = fragment.querySelector(".todo-edit");
    const deleteButton = fragment.querySelector(".todo-delete");
    const editForm = fragment.querySelector(".todo-edit-form");
    const editInput = fragment.querySelector(".todo-edit-input");
    const saveButton = fragment.querySelector(".todo-save");
    const cancelButton = fragment.querySelector(".todo-cancel");
    const view = fragment.querySelector(".todo-view");
    const isBusy = state.pendingIds.has(todo.id);
    const isEditing = state.editingId === todo.id;

    item.dataset.todoId = todo.id;
    checkbox.checked = Boolean(todo.completed);
    checkbox.setAttribute("aria-label", "Mark " + todo.title + " complete");
    title.textContent = todo.title;
    title.classList.toggle("is-completed", Boolean(todo.completed));

    setBusy(checkbox, isBusy);
    setBusy(editButton, isBusy);
    setBusy(deleteButton, isBusy);
    setBusy(editInput, isBusy);
    setBusy(saveButton, isBusy);
    setBusy(cancelButton, isBusy);

    view.hidden = isEditing;
    editForm.hidden = !isEditing;
    editInput.value = todo.title;

    checkbox.addEventListener("change", function () {
      updateTodo(todo.id, { completed: checkbox.checked }, "Todo updated.");
    });

    editButton.addEventListener("click", function () {
      state.editingId = todo.id;
      clearMessages();
      render();
      const nextItem = Array.from(elements.todoList.children).find(function (node) {
        return node.dataset.todoId === todo.id;
      });
      const nextInput = nextItem ? nextItem.querySelector(".todo-edit-input") : null;

      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    });

    deleteButton.addEventListener("click", function () {
      deleteTodo(todo.id);
    });

    cancelButton.addEventListener("click", function () {
      state.editingId = null;
      clearMessages();
      render();
    });

    editForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const nextTitle = normalizeTitle(editInput.value);

      if (!nextTitle) {
        setError("Todo title is required.");
        editInput.focus();
        return;
      }

      updateTodo(todo.id, { title: nextTitle }, "Todo updated.");
    });

    return fragment;
  }

  function renderTodos() {
    elements.todoList.innerHTML = "";

    for (const todo of state.todos) {
      elements.todoList.appendChild(renderTodoItem(todo));
    }
  }

  function render() {
    const isBusy = state.loading || state.creating;

    renderMessages();
    elements.loadingState.hidden = !state.loading;
    elements.emptyState.hidden = state.loading || state.todos.length > 0 || Boolean(state.error);
    elements.todoList.hidden = state.loading || state.todos.length === 0;
    elements.todoList.closest("section").setAttribute("aria-busy", String(state.loading));

    setBusy(elements.newTodoTitle, state.creating);
    setBusy(elements.createButton, isBusy);

    renderTodos();
  }

  elements.createForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const title = normalizeTitle(elements.newTodoTitle.value);

    if (!title) {
      setError("Todo title is required.");
      elements.newTodoTitle.focus();
      return;
    }

    createTodo(title);
  });

  loadTodos();
})();
