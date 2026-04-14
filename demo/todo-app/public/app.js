(function (globalScope) {
  function setHeaders(options) {
    return {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    };
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
    if (typeof globalScope.fetch !== "function") {
      throw new Error("Fetch is not available in this environment.");
    }

    const response = await globalScope.fetch(path, setHeaders(options));
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

  function createTodoApp(options) {
    if (!options || typeof options.request !== "function") {
      throw new Error("A request function is required.");
    }

    const state = {
      todos: [],
      loading: false,
      error: "",
      status: "",
      editingId: null,
      pendingIds: new Set(),
      creating: false,
    };
    const onStateChange =
      typeof options.onStateChange === "function" ? options.onStateChange : function () {};

    function notify() {
      onStateChange(state);
    }

    function setError(message) {
      state.error = message;
      notify();
    }

    function setStatus(message) {
      state.status = message;
      notify();
    }

    function clearMessages() {
      state.error = "";
      state.status = "";
    }

    async function loadTodos(config) {
      const shouldThrow = Boolean(config && config.throwOnError);

      state.loading = true;
      state.error = "";
      notify();

      try {
        const payload = await options.request("/api/todos", { method: "GET" });
        state.todos = normalizeTodoList(payload);
        return state.todos;
      } catch (error) {
        state.todos = [];
        setError(error.message);

        if (shouldThrow) {
          throw error;
        }

        return null;
      } finally {
        state.loading = false;
        notify();
      }
    }

    async function submitCreate(rawTitle, controls) {
      const title = normalizeTitle(rawTitle);

      if (!title) {
        setError("Todo title is required.");

        if (controls && typeof controls.focusInvalid === "function") {
          controls.focusInvalid();
        }

        return false;
      }

      state.creating = true;
      clearMessages();
      notify();

      try {
        await options.request("/api/todos", {
          method: "POST",
          body: JSON.stringify({ title }),
        });

        if (controls && typeof controls.resetForm === "function") {
          controls.resetForm();
        }

        await loadTodos({ throwOnError: true });
        setStatus("Todo created.");
        return true;
      } catch (error) {
        setError(error.message);
        return false;
      } finally {
        state.creating = false;
        notify();
      }
    }

    async function updateTodo(id, updates, successMessage) {
      state.pendingIds.add(id);
      clearMessages();
      notify();

      try {
        await options.request("/api/todos/" + encodeURIComponent(id), {
          method: "PATCH",
          body: JSON.stringify(updates),
        });

        state.editingId = null;
        await loadTodos({ throwOnError: true });
        setStatus(successMessage);
        return true;
      } catch (error) {
        setError(error.message);
        return false;
      } finally {
        state.pendingIds.delete(id);
        notify();
      }
    }

    async function submitUpdateTitle(id, rawTitle, controls) {
      const title = normalizeTitle(rawTitle);

      if (!title) {
        setError("Todo title is required.");

        if (controls && typeof controls.focusInvalid === "function") {
          controls.focusInvalid();
        }

        return false;
      }

      return updateTodo(id, { title: title }, "Todo updated.");
    }

    async function toggleTodo(id, completed) {
      return updateTodo(id, { completed: completed }, "Todo updated.");
    }

    async function deleteTodo(id) {
      state.pendingIds.add(id);
      clearMessages();
      notify();

      try {
        await options.request("/api/todos/" + encodeURIComponent(id), {
          method: "DELETE",
        });

        if (state.editingId === id) {
          state.editingId = null;
        }

        await loadTodos({ throwOnError: true });
        setStatus("Todo deleted.");
        return true;
      } catch (error) {
        setError(error.message);
        return false;
      } finally {
        state.pendingIds.delete(id);
        notify();
      }
    }

    function startEditing(id) {
      state.editingId = id;
      clearMessages();
      notify();
    }

    function cancelEditing() {
      state.editingId = null;
      clearMessages();
      notify();
    }

    return {
      state: state,
      loadTodos: loadTodos,
      submitCreate: submitCreate,
      submitUpdateTitle: submitUpdateTitle,
      toggleTodo: toggleTodo,
      deleteTodo: deleteTodo,
      startEditing: startEditing,
      cancelEditing: cancelEditing,
    };
  }

  function initializeTodoApp(rootDocument) {
    const elements = {
      createForm: rootDocument.querySelector("#create-form"),
      createButton: rootDocument.querySelector("#create-button"),
      newTodoTitle: rootDocument.querySelector("#new-todo-title"),
      errorBanner: rootDocument.querySelector("#error-banner"),
      statusBanner: rootDocument.querySelector("#status-banner"),
      loadingState: rootDocument.querySelector("#loading-state"),
      emptyState: rootDocument.querySelector("#empty-state"),
      todoList: rootDocument.querySelector("#todo-list"),
      itemTemplate: rootDocument.querySelector("#todo-item-template"),
    };

    function setBusy(element, busy) {
      element.disabled = busy;
    }

    const app = createTodoApp({
      request: request,
      onStateChange: render,
    });

    function renderMessages() {
      elements.errorBanner.hidden = !app.state.error;
      elements.errorBanner.textContent = app.state.error;

      elements.statusBanner.hidden = !app.state.status;
      elements.statusBanner.textContent = app.state.status;
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
      const isBusy = app.state.pendingIds.has(todo.id);
      const isEditing = app.state.editingId === todo.id;

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
        app.toggleTodo(todo.id, checkbox.checked);
      });

      editButton.addEventListener("click", function () {
        app.startEditing(todo.id);
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
        app.deleteTodo(todo.id);
      });

      cancelButton.addEventListener("click", function () {
        app.cancelEditing();
      });

      editForm.addEventListener("submit", function (event) {
        event.preventDefault();
        app.submitUpdateTitle(todo.id, editInput.value, {
          focusInvalid: function () {
            editInput.focus();
          },
        });
      });

      return fragment;
    }

    function renderTodos() {
      elements.todoList.innerHTML = "";

      for (const todo of app.state.todos) {
        elements.todoList.appendChild(renderTodoItem(todo));
      }
    }

    function render() {
      const isBusy = app.state.loading || app.state.creating;

      renderMessages();
      elements.loadingState.hidden = !app.state.loading;
      elements.emptyState.hidden =
        app.state.loading || app.state.todos.length > 0 || Boolean(app.state.error);
      elements.todoList.hidden = app.state.loading || app.state.todos.length === 0;
      elements.todoList.closest("section").setAttribute("aria-busy", String(app.state.loading));

      setBusy(elements.newTodoTitle, app.state.creating);
      setBusy(elements.createButton, isBusy);

      renderTodos();
    }

    elements.createForm.addEventListener("submit", function (event) {
      event.preventDefault();
      app.submitCreate(elements.newTodoTitle.value, {
        resetForm: function () {
          elements.createForm.reset();
        },
        focusInvalid: function () {
          elements.newTodoTitle.focus();
        },
      });
    });

    app.loadTodos();
    return app;
  }

  const exported = {
    createTodoApp: createTodoApp,
    initializeTodoApp: initializeTodoApp,
    normalizeTitle: normalizeTitle,
    normalizeTodoList: normalizeTodoList,
    parseJson: parseJson,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }

  if (globalScope.document) {
    initializeTodoApp(globalScope.document);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
