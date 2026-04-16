const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

class TodoStore {
  constructor(filePath) {
    if (!filePath) {
      throw new TypeError('A todo data file path is required.');
    }

    this.filePath = filePath;
    this.writeChain = Promise.resolve();
  }

  async listTodos() {
    const todos = await this._readTodos();
    return todos.map((todo) => ({ ...todo }));
  }

  async createTodo(input) {
    const title = normalizeTitle(input && input.title);

    return this._withWrite(async (todos) => {
      const timestamp = new Date().toISOString();
      const todo = {
        id: randomUUID(),
        title,
        completed: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      return {
        todos: [...todos, todo],
        result: todo
      };
    });
  }

  async updateTodo(id, updates) {
    const normalizedId = normalizeId(id);
    const nextValues = normalizeUpdatePayload(updates);

    return this._withWrite(async (todos) => {
      const index = todos.findIndex((todo) => todo.id === normalizedId);

      if (index === -1) {
        return null;
      }

      const current = todos[index];
      const updatedTodo = {
        ...current,
        ...nextValues,
        updatedAt: new Date().toISOString()
      };
      const nextTodos = [...todos];
      nextTodos[index] = updatedTodo;

      return {
        todos: nextTodos,
        result: updatedTodo
      };
    });
  }

  async deleteTodo(id) {
    const normalizedId = normalizeId(id);

    return this._withWrite(async (todos) => {
      const index = todos.findIndex((todo) => todo.id === normalizedId);

      if (index === -1) {
        return null;
      }

      const nextTodos = [...todos];
      const [deletedTodo] = nextTodos.splice(index, 1);

      return {
        todos: nextTodos,
        result: deletedTodo
      };
    });
  }

  async _withWrite(mutator) {
    const run = this.writeChain.then(async () => {
      const todos = await this._readTodos();
      const outcome = await mutator(todos);

      if (outcome === null) {
        return null;
      }

      if (!outcome || !Array.isArray(outcome.todos)) {
        throw new Error('Todo mutations must return a todos array.');
      }

      await this._writeTodos(outcome.todos);
      return outcome.result;
    });

    this.writeChain = run.catch(() => undefined);
    return run;
  }

  async _readTodos() {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');

      if (!content.trim()) {
        return [];
      }

      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed)) {
        throw new TypeError('Todo data file must contain a JSON array.');
      }

      return parsed.map(normalizeStoredTodo);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  async _writeTodos(todos) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(todos, null, 2)}\n`, 'utf8');
  }
}

function normalizeStoredTodo(todo) {
  if (!todo || typeof todo !== 'object') {
    throw new TypeError('Stored todos must be objects.');
  }

  const { id, title, completed, createdAt, updatedAt } = todo;

  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof completed !== 'boolean' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string'
  ) {
    throw new TypeError('Stored todos must match the expected shape.');
  }

  return { id, title, completed, createdAt, updatedAt };
}

function normalizeId(id) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new TypeError('Todo id must be a non-empty string.');
  }

  return id;
}

function normalizeTitle(title) {
  if (typeof title !== 'string') {
    throw new TypeError('Todo title must be a string.');
  }

  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new TypeError('Todo title must not be empty.');
  }

  return normalizedTitle;
}

function normalizeUpdatePayload(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new TypeError('Todo updates must be a JSON object.');
  }

  const nextValues = {};
  const hasTitle = Object.prototype.hasOwnProperty.call(updates, 'title');
  const hasCompleted = Object.prototype.hasOwnProperty.call(updates, 'completed');

  if (!hasTitle && !hasCompleted) {
    throw new TypeError('Todo updates must include title or completed.');
  }

  if (hasTitle) {
    nextValues.title = normalizeTitle(updates.title);
  }

  if (hasCompleted) {
    if (typeof updates.completed !== 'boolean') {
      throw new TypeError('Todo completed must be a boolean.');
    }

    nextValues.completed = updates.completed;
  }

  return nextValues;
}

module.exports = {
  TodoStore,
  normalizeTitle
};
