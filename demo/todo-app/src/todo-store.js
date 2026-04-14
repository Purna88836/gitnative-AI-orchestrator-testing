import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class TodoStoreError extends Error {
  constructor(message, { code, status = 400, cause } = {}) {
    super(message, { cause });
    this.name = 'TodoStoreError';
    this.code = code ?? 'TODO_STORE_ERROR';
    this.status = status;
  }
}

function validateTitle(title) {
  return typeof title === 'string' && title.trim().length > 0;
}

function cloneTodo(todo) {
  return { ...todo };
}

export class TodoStore {
  #writeQueue = Promise.resolve();

  constructor({ filePath }) {
    if (!filePath) {
      throw new TypeError('filePath is required');
    }

    this.filePath = filePath;
  }

  async list() {
    const todos = await this.#readTodos();
    return todos.map(cloneTodo);
  }

  async create(input) {
    if (!validateTitle(input?.title)) {
      throw new TodoStoreError('Title is required.', {
        code: 'INVALID_TITLE',
        status: 400
      });
    }

    const todo = {
      id: randomUUID(),
      title: input.title.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };

    return this.#mutate(async (todos) => ({
      todos: [...todos, todo],
      value: cloneTodo(todo)
    }));
  }

  async update(id, updates) {
    if (!id) {
      throw new TodoStoreError('Todo id is required.', {
        code: 'INVALID_ID',
        status: 400
      });
    }

    const hasTitle = Object.hasOwn(updates ?? {}, 'title');
    const hasCompleted = Object.hasOwn(updates ?? {}, 'completed');

    if (!hasTitle && !hasCompleted) {
      throw new TodoStoreError('Update payload must include title or completed.', {
        code: 'INVALID_UPDATE',
        status: 400
      });
    }

    if (hasTitle && !validateTitle(updates.title)) {
      throw new TodoStoreError('Title must be a non-empty string.', {
        code: 'INVALID_TITLE',
        status: 400
      });
    }

    if (hasCompleted && typeof updates.completed !== 'boolean') {
      throw new TodoStoreError('Completed must be a boolean.', {
        code: 'INVALID_COMPLETED',
        status: 400
      });
    }

    return this.#mutate(async (todos) => {
      const index = todos.findIndex((todo) => todo.id === id);

      if (index === -1) {
        throw new TodoStoreError(`Todo ${id} was not found.`, {
          code: 'TODO_NOT_FOUND',
          status: 404
        });
      }

      const updatedTodo = {
        ...todos[index],
        ...(hasTitle ? { title: updates.title.trim() } : {}),
        ...(hasCompleted ? { completed: updates.completed } : {})
      };

      const nextTodos = [...todos];
      nextTodos[index] = updatedTodo;

      return {
        todos: nextTodos,
        value: cloneTodo(updatedTodo)
      };
    });
  }

  async remove(id) {
    if (!id) {
      throw new TodoStoreError('Todo id is required.', {
        code: 'INVALID_ID',
        status: 400
      });
    }

    return this.#mutate(async (todos) => {
      const index = todos.findIndex((todo) => todo.id === id);

      if (index === -1) {
        throw new TodoStoreError(`Todo ${id} was not found.`, {
          code: 'TODO_NOT_FOUND',
          status: 404
        });
      }

      const nextTodos = [...todos];
      const [removedTodo] = nextTodos.splice(index, 1);

      return {
        todos: nextTodos,
        value: cloneTodo(removedTodo)
      };
    });
  }

  async #ensureFile() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        await writeFile(this.filePath, '[]\n', 'utf8');
        return;
      }

      throw error;
    }
  }

  async #readTodos() {
    await this.#ensureFile();

    try {
      const fileContents = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(fileContents || '[]');

      if (!Array.isArray(parsed)) {
        throw new Error('Todo store must contain an array.');
      }

      return parsed;
    } catch (error) {
      if (error instanceof TodoStoreError) {
        throw error;
      }

      throw new TodoStoreError('Todo data could not be read.', {
        code: 'STORE_READ_FAILED',
        status: 500,
        cause: error
      });
    }
  }

  async #writeTodos(todos) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(todos, null, 2)}\n`, 'utf8');
  }

  async #mutate(operation) {
    const nextMutation = this.#writeQueue.catch(() => undefined).then(async () => {
      const currentTodos = await this.#readTodos();
      const result = await operation(currentTodos);

      await this.#writeTodos(result.todos);
      return result.value;
    });

    this.#writeQueue = nextMutation.catch(() => undefined);
    return nextMutation;
  }
}
