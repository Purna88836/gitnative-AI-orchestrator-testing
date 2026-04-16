import assert from 'node:assert/strict';
import test from 'node:test';

import { createTodoApp, extractErrorMessage, request } from '../public/app.js';

function createRequestQueue(steps) {
  const calls = [];

  async function queuedRequest(path, options) {
    const step = steps.shift();

    if (!step) {
      throw new Error(`Unexpected request for ${path}`);
    }

    calls.push({ path, options });

    if (step.path) {
      assert.equal(path, step.path);
    }

    if (step.method) {
      assert.equal(options && options.method, step.method);
    }

    if (step.body !== undefined) {
      assert.equal(options && options.body, JSON.stringify(step.body));
    }

    if (step.error) {
      throw step.error;
    }

    return step.result;
  }

  queuedRequest.calls = calls;
  return queuedRequest;
}

test('request surfaces nested API error messages', async () => {
  await assert.rejects(
    request(
      '/api/todos',
      { method: 'POST' },
      async () =>
        new Response(JSON.stringify({ error: { code: 'INVALID_TITLE', message: 'Title is required.' } }), {
          status: 400,
          headers: {
            'content-type': 'application/json'
          }
        })
    ),
    /Title is required\./
  );

  assert.equal(extractErrorMessage({}), 'The request failed. Please try again.');
});

test('loadTodos surfaces initial load failures', async () => {
  const app = createTodoApp({
    request: createRequestQueue([
      {
        path: '/api/todos',
        method: 'GET',
        error: new Error('Todo list unavailable.')
      }
    ])
  });

  await assert.rejects(app.loadTodos({ throwOnError: true }), /Todo list unavailable\./);

  assert.deepEqual(app.state.todos, []);
  assert.equal(app.state.error, 'Todo list unavailable.');
  assert.equal(app.state.status, '');
  assert.equal(app.state.loading, false);
});

test('submitCreate rejects empty titles before making a request', async () => {
  let focused = 0;
  let requestCalled = false;
  const app = createTodoApp({
    request: async () => {
      requestCalled = true;
      throw new Error('should not be called');
    }
  });

  const result = await app.submitCreate('   ', {
    focusInvalid() {
      focused += 1;
    }
  });

  assert.equal(result, false);
  assert.equal(requestCalled, false);
  assert.equal(focused, 1);
  assert.equal(app.state.error, 'Todo title is required.');
  assert.equal(app.state.status, '');
  assert.equal(app.state.creating, false);
});

test('submitUpdateTitle rejects empty edits before making a request', async () => {
  let focused = 0;
  let requestCalled = false;
  const app = createTodoApp({
    request: async () => {
      requestCalled = true;
      throw new Error('should not be called');
    }
  });

  const result = await app.submitUpdateTitle('abc', '   ', {
    focusInvalid() {
      focused += 1;
    }
  });

  assert.equal(result, false);
  assert.equal(requestCalled, false);
  assert.equal(focused, 1);
  assert.equal(app.state.error, 'Todo title is required.');
  assert.equal(app.state.status, '');
});

test('submitCreate only shows success after the refresh succeeds', async () => {
  const app = createTodoApp({
    request: createRequestQueue([
      {
        path: '/api/todos',
        method: 'POST',
        body: { title: 'Ship tests' },
        result: { id: 'created' }
      },
      {
        path: '/api/todos',
        method: 'GET',
        error: new Error('Refresh failed.')
      }
    ])
  });
  let resetCount = 0;

  const result = await app.submitCreate('Ship tests', {
    resetForm() {
      resetCount += 1;
    }
  });

  assert.equal(result, false);
  assert.equal(resetCount, 1);
  assert.equal(app.state.error, 'Refresh failed.');
  assert.equal(app.state.status, '');
  assert.deepEqual(app.state.todos, []);
  assert.equal(app.state.creating, false);
});

test('submitCreate updates the list and status after a successful refresh', async () => {
  const todo = { id: '1', title: 'Ship tests', completed: false };
  const app = createTodoApp({
    request: createRequestQueue([
      {
        path: '/api/todos',
        method: 'POST',
        body: { title: 'Ship tests' },
        result: todo
      },
      {
        path: '/api/todos',
        method: 'GET',
        result: [todo]
      }
    ])
  });

  const result = await app.submitCreate('Ship tests');

  assert.equal(result, true);
  assert.equal(app.state.error, '');
  assert.equal(app.state.status, 'Todo created.');
  assert.deepEqual(app.state.todos, [todo]);
});

test('toggleTodo keeps refresh failures in the error state', async () => {
  const todo = { id: 'abc', title: 'Ship tests', completed: false };
  const app = createTodoApp({
    request: createRequestQueue([
      {
        path: '/api/todos/abc',
        method: 'PATCH',
        body: { completed: true },
        result: { ...todo, completed: true }
      },
      {
        path: '/api/todos',
        method: 'GET',
        error: new Error('Refresh failed.')
      }
    ])
  });

  app.state.todos = [todo];

  const result = await app.toggleTodo('abc', true);

  assert.equal(result, false);
  assert.equal(app.state.error, 'Refresh failed.');
  assert.equal(app.state.status, '');
  assert.equal(app.state.pendingIds.size, 0);
});

test('deleteTodo clears editing state after a successful refresh', async () => {
  const todo = { id: 'abc', title: 'Ship tests', completed: false };
  const app = createTodoApp({
    request: createRequestQueue([
      {
        path: '/api/todos/abc',
        method: 'DELETE',
        result: null
      },
      {
        path: '/api/todos',
        method: 'GET',
        result: []
      }
    ])
  });

  app.state.todos = [todo];
  app.state.editingId = 'abc';

  const result = await app.deleteTodo('abc');

  assert.equal(result, true);
  assert.equal(app.state.editingId, null);
  assert.equal(app.state.error, '');
  assert.equal(app.state.status, 'Todo deleted.');
  assert.deepEqual(app.state.todos, []);
  assert.equal(app.state.pendingIds.size, 0);
});
