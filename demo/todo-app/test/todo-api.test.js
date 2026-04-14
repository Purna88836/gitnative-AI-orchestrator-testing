import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAppServer } from '../server.js';
import { TodoStore } from '../src/todo-store.js';

async function createApiHarness() {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'todo-api-'));
  const store = new TodoStore({
    filePath: join(tempDirectory, 'todos.json')
  });
  const server = createAppServer({
    store,
    publicDir: join(tempDirectory, 'public')
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
}

async function request(baseUrl, path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const rawBody = await response.text();

  return {
    response,
    body: rawBody ? JSON.parse(rawBody) : null
  };
}

test('todo API supports create, list, update, and delete flows', async () => {
  const api = await createApiHarness();

  try {
    const createResult = await request(api.baseUrl, '/api/todos', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ title: 'Ship the Todo demo' })
    });

    assert.equal(createResult.response.status, 201);
    assert.equal(createResult.body.todo.title, 'Ship the Todo demo');
    assert.equal(createResult.body.todo.completed, false);

    const listAfterCreate = await request(api.baseUrl, '/api/todos');
    assert.equal(listAfterCreate.response.status, 200);
    assert.deepEqual(listAfterCreate.body.todos, [createResult.body.todo]);

    const updateResult = await request(api.baseUrl, `/api/todos/${createResult.body.todo.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Ship the tested Todo demo',
        completed: true
      })
    });

    assert.equal(updateResult.response.status, 200);
    assert.equal(updateResult.body.todo.title, 'Ship the tested Todo demo');
    assert.equal(updateResult.body.todo.completed, true);

    const deleteResult = await request(api.baseUrl, `/api/todos/${createResult.body.todo.id}`, {
      method: 'DELETE'
    });
    assert.equal(deleteResult.response.status, 204);
    assert.equal(deleteResult.body, null);

    const finalList = await request(api.baseUrl, '/api/todos');
    assert.equal(finalList.response.status, 200);
    assert.deepEqual(finalList.body.todos, []);
  } finally {
    await api.close();
  }
});

test('todo API returns 400 responses for invalid payloads', async () => {
  const api = await createApiHarness();

  try {
    const invalidCreate = await request(api.baseUrl, '/api/todos', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ title: '   ' })
    });

    assert.equal(invalidCreate.response.status, 400);
    assert.equal(invalidCreate.body.error.code, 'INVALID_TITLE');

    const createValidTodo = await request(api.baseUrl, '/api/todos', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ title: 'Keep this todo' })
    });

    const invalidUpdate = await request(api.baseUrl, `/api/todos/${createValidTodo.body.todo.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({})
    });

    assert.equal(invalidUpdate.response.status, 400);
    assert.equal(invalidUpdate.body.error.code, 'INVALID_UPDATE');

    const malformedJson = await request(api.baseUrl, '/api/todos', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: '{"title":'
    });

    assert.equal(malformedJson.response.status, 400);
    assert.equal(malformedJson.body.error.code, 'INVALID_JSON');
  } finally {
    await api.close();
  }
});

test('todo API returns 404 and 405 responses for error cases', async () => {
  const api = await createApiHarness();

  try {
    const missingTodoUpdate = await request(api.baseUrl, '/api/todos/missing-id', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ completed: true })
    });

    assert.equal(missingTodoUpdate.response.status, 404);
    assert.equal(missingTodoUpdate.body.error.code, 'TODO_NOT_FOUND');

    const missingTodoDelete = await request(api.baseUrl, '/api/todos/missing-id', {
      method: 'DELETE'
    });

    assert.equal(missingTodoDelete.response.status, 404);
    assert.equal(missingTodoDelete.body.error.code, 'TODO_NOT_FOUND');

    const wrongMethod = await request(api.baseUrl, '/api/todos/missing-id', {
      method: 'GET'
    });

    assert.equal(wrongMethod.response.status, 405);
    assert.equal(wrongMethod.body.error.code, 'METHOD_NOT_ALLOWED');

    const unknownRoute = await request(api.baseUrl, '/api/todos/missing-id/extra');
    assert.equal(unknownRoute.response.status, 404);
    assert.equal(unknownRoute.body.error.code, 'ROUTE_NOT_FOUND');
  } finally {
    await api.close();
  }
});
