(() => {
  "use strict";

  const state = {
    todos: [],
    loading: true,
    creating: false,
    savingIds: new Set(),
    editingId: null,
  };

  const todoForm = document.querySelector("#todo-form");
  const titleInput = document.querySelector("#todo-title");
  const addButton = document.querySelector("#add-button");
  const refreshButton = document.querySelector("#refresh-button");
  const statusMessage = document.querySelector("#status-message");
  const errorMessage = document.querySelector("#error-message");
  const loadingState = document.querySelector("#loading-state");
  const emptyState = document.querySelector("#empty-state");
  const todoList = document.querySelector("#todo-list");
  const itemTemplate = document.querySelector("#todo-item-template");

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function setStatus(message) {
    statusMessage.textContent = message;
  }

  function clearError() {
    errorMessage.hidden = true;
    errorMessage.textContent = "";
  }

  function showError(message) {
    errorMessage.hidden = false;
    errorMessage.textContent = message;
    setStatus("A request failed. Review the error message and try again.");
  }

  function setBusy(id, busy) {
    if (busy) {
      state.savingIds.add(id);
    } else {
      state.savingIds.delete(id);
    }
  }

  function isBusy(id) {
    return state.savingIds.has(id);
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return dateFormatter.format(date);
  }

  function formatTodoMeta(todo) {
    const details = [todo.completed ? "Completed" : "Open"];
    const createdAt = formatDate(todo.createdAt);
    const updatedAt = formatDate(todo.updatedAt);

    if (createdAt) {
      details.push(`Created ${createdAt}`);
    }

    if (updatedAt && updatedAt !== createdAt) {
      details.push(`Updated ${updatedAt}`);
    }

    return details.join(" · ");
  }

  async function request(path, options = {}) {
    const config = {
      headers: {
        Accept: "application/json",
      },
      ...options,
    };

    if (config.body) {
      config.headers = {
        ...config.headers,
        "Content-Type": "application/json",
      };
    }

    const response = await fetch(path, config);
    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = null;
      }
    }

    if (!response.ok) {
      const message = payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}.`;
      throw new Error(message);
    }

    return payload;
  }

  function normalizeTodos(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && Array.isArray(payload.todos)) {
      return payload.todos;
    }

    return [];
  }

  function render() {
    const hasTodos = state.todos.length > 0;

    loadingState.hidden = !state.loading;
    emptyState.hidden = state.loading || hasTodos;
    todoList.hidden = state.loading || !hasTodos;
    addButton.disabled = state.creating;
    titleInput.disabled = state.creating;
    refreshButton.disabled = state.loading || state.creating || state.savingIds.size > 0;

    todoList.replaceChildren();

    for (const todo of state.todos) {
      const item = itemTemplate.content.firstElementChild.cloneNode(true);
      const isEditing = state.editingId === todo.id;
      const busy = isBusy(todo.id);
      const toggle = item.querySelector(".todo-toggle");
      const title = item.querySelector(".todo-title");
      const meta = item.querySelector(".todo-meta");
      const editButton = item.querySelector(".edit-button");
      const deleteButton = item.querySelector(".delete-button");
      const view = item.querySelector(".todo-view");
      const editForm = item.querySelector(".edit-form");
      const editInput = item.querySelector(".edit-input");
      const cancelButton = item.querySelector(".cancel-edit-button");
      const saveButton = item.querySelector(".save-button");

      item.dataset.todoId = todo.id;
      item.dataset.editing = String(isEditing);
      item.classList.toggle("is-complete", Boolean(todo.completed));

      toggle.checked = Boolean(todo.completed);
      toggle.disabled = busy;
      title.textContent = todo.title;
      meta.textContent = formatTodoMeta(todo);
      editButton.disabled = busy;
      deleteButton.disabled = busy;
      saveButton.disabled = busy;
      cancelButton.disabled = busy;

      view.hidden = isEditing;
      editForm.hidden = !isEditing;
      editInput.value = todo.title;
      editInput.disabled = busy;

      toggle.addEventListener("change", () => {
        handleToggle(todo, toggle.checked);
      });

      editButton.addEventListener("click", () => {
        clearError();
        state.editingId = todo.id;
        setStatus(`Editing \"${todo.title}\".`);
        render();
      });

      deleteButton.addEventListener("click", () => {
        handleDelete(todo);
      });

      cancelButton.addEventListener("click", () => {
        state.editingId = null;
        setStatus(`Canceled changes for \"${todo.title}\".`);
        render();
      });

      editForm.addEventListener("submit", (event) => {
        event.preventDefault();
        handleEdit(todo, editInput.value);
      });

      todoList.appendChild(item);
    }

    const editingInput = todoList.querySelector('.todo-item[data-editing="true"] .edit-input');
    if (editingInput) {
      editingInput.focus();
      editingInput.select();
    }
  }

  async function loadTodos({ announceLoading = true, successMessage = "" } = {}) {
    state.loading = true;

    if (announceLoading) {
      setStatus("Loading todos...");
    }

    clearError();
    render();

    try {
      const payload = await request("/api/todos");
      state.todos = normalizeTodos(payload);

      if (successMessage) {
        setStatus(successMessage);
      } else if (state.todos.length === 0) {
        setStatus("No todos yet. Add your first task above.");
      } else {
        const count = state.todos.length;
        setStatus(`Loaded ${count} todo${count === 1 ? "" : "s"}.`);
      }
    } catch (error) {
      state.todos = [];
      showError(error instanceof Error ? error.message : "Unable to load todos.");
    } finally {
      state.loading = false;
      render();
    }
  }

  async function handleCreate(event) {
    event.preventDefault();

    const title = titleInput.value.trim();
    if (!title) {
      showError("Enter a title before adding a todo.");
      titleInput.focus();
      return;
    }

    state.creating = true;
    clearError();
    setStatus("Adding todo...");
    render();

    try {
      await request("/api/todos", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      todoForm.reset();
      await loadTodos({ announceLoading: false, successMessage: "Todo added." });
      titleInput.focus();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to add todo.");
    } finally {
      state.creating = false;
      render();
    }
  }

  async function handleToggle(todo, completed) {
    clearError();
    setBusy(todo.id, true);
    setStatus(completed ? `Marking \"${todo.title}\" complete...` : `Reopening \"${todo.title}\"...`);
    render();

    try {
      await request(`/api/todos/${encodeURIComponent(todo.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });
      await loadTodos({
        announceLoading: false,
        successMessage: completed ? "Todo marked complete." : "Todo marked active.",
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to update todo.");
    } finally {
      setBusy(todo.id, false);
      render();
    }
  }

  async function handleEdit(todo, nextTitle) {
    const title = nextTitle.trim();
    if (!title) {
      showError("Todo titles cannot be empty.");
      return;
    }

    clearError();
    setBusy(todo.id, true);
    setStatus(`Saving \"${todo.title}\"...`);
    render();

    try {
      await request(`/api/todos/${encodeURIComponent(todo.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      state.editingId = null;
      await loadTodos({ announceLoading: false, successMessage: "Todo updated." });
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to update todo.");
    } finally {
      setBusy(todo.id, false);
      render();
    }
  }

  async function handleDelete(todo) {
    const confirmed = window.confirm(`Delete \"${todo.title}\"?`);
    if (!confirmed) {
      return;
    }

    clearError();
    setBusy(todo.id, true);
    setStatus(`Deleting \"${todo.title}\"...`);
    render();

    try {
      await request(`/api/todos/${encodeURIComponent(todo.id)}`, {
        method: "DELETE",
      });
      if (state.editingId === todo.id) {
        state.editingId = null;
      }
      await loadTodos({ announceLoading: false, successMessage: "Todo deleted." });
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to delete todo.");
    } finally {
      setBusy(todo.id, false);
      render();
    }
  }

  refreshButton.addEventListener("click", () => {
    loadTodos();
  });

  todoForm.addEventListener("submit", handleCreate);
  loadTodos();
})();
