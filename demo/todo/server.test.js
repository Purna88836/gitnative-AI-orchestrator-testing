const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { TodoStore } = require('./lib/todo-store');
const { createTodoServer } = require('./server');

test('Todo API supports the CRUD contract', async (t) => {
  const { baseUrl } = await startTestServer(t);

  const initialList = await requestJson(baseUrl, 'GET', '/api/todos');
  assert.equal(initialList.statusCode, 200);
  assert.deepEqual(initialList.body, { todos: [] });

  const created = await requestJson(baseUrl, 'POST', '/api/todos', {
    title: 'Write API contract'
  });
  assert.equal(created.statusCode, 201);
  assert.match(created.headers.location, /^\/api\/todos\/.+/);
  assert.equal(created.body.todo.title, 'Write API contract');
  assert.equal(created.body.todo.completed, false);

  const updated = await requestJson(
    baseUrl,
    'PATCH',
    `/api/todos/${created.body.todo.id}`,
    { completed: true }
  );
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.todo.completed, true);

  const removed = await requestJson(baseUrl, 'DELETE', `/api/todos/${created.body.todo.id}`);
  assert.equal(removed.statusCode, 204);
  assert.equal(removed.body, null);

  const finalList = await requestJson(baseUrl, 'GET', '/api/todos');
  assert.deepEqual(finalList.body, { todos: [] });
});

test('Todo API returns JSON errors for invalid requests', async (t) => {
  const { baseUrl } = await startTestServer(t);

  const invalidCreate = await requestJson(baseUrl, 'POST', '/api/todos', { title: '   ' });
  assert.equal(invalidCreate.statusCode, 400);
  assert.deepEqual(invalidCreate.body, { error: 'Todo title must not be empty.' });

  const missingTodo = await requestJson(baseUrl, 'PATCH', '/api/todos/missing-id', {
    completed: true
  });
  assert.equal(missingTodo.statusCode, 404);
  assert.deepEqual(missingTodo.body, { error: 'Todo not found.' });

  const wrongMethod = await requestJson(baseUrl, 'PUT', '/api/todos');
  assert.equal(wrongMethod.statusCode, 405);
  assert.deepEqual(wrongMethod.body, {
    error: 'Method not allowed. Supported methods: GET, POST.'
  });
});

async function startTestServer(t) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-server-'));
  const store = new TodoStore(path.join(tempDirectory, 'todos.json'));
  const server = createTodoServer({ store });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  );

  const address = server.address();
  return { baseUrl: `http://127.0.0.1:${address.port}` };
}

function requestJson(baseUrl, method, routePath, payload) {
  const url = new URL(routePath, baseUrl);
  const body = payload === undefined ? null : JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method,
        headers: body
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body)
            }
          : undefined
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const responseText = Buffer.concat(chunks).toString('utf8');
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: responseText ? JSON.parse(responseText) : null
          });
        });
      }
    );

    request.on('error', reject);

    if (body) {
      request.write(body);
    }

    request.end();
  });
}
