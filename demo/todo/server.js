const http = require('node:http');
const path = require('node:path');

const { TodoStore } = require('./lib/todo-store');

function createTodoServer(options) {
  if (!options || !options.store) {
    throw new TypeError('A todo store instance is required.');
  }

  const { store } = options;

  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const pathname = normalizePathname(requestUrl.pathname);

      if (pathname === '/api/todos') {
        await handleCollectionRoute(request, response, store);
        return;
      }

      const todoIdMatch = pathname.match(/^\/api\/todos\/([^/]+)$/);

      if (todoIdMatch) {
        const todoId = decodeURIComponent(todoIdMatch[1]);
        await handleItemRoute(request, response, store, todoId);
        return;
      }

      sendJson(response, 404, { error: 'Route not found.' });
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: 'Request body must be valid JSON.' });
        return;
      }

      if (error instanceof TypeError) {
        sendJson(response, 400, { error: error.message });
        return;
      }

      sendJson(response, 500, { error: 'Internal server error.' });
    }
  });
}

async function handleCollectionRoute(request, response, store) {
  if (request.method === 'GET') {
    const todos = await store.listTodos();
    sendJson(response, 200, { todos });
    return;
  }

  if (request.method === 'POST') {
    const payload = await readJsonBody(request);
    const todo = await store.createTodo(payload);
    response.setHeader('Location', `/api/todos/${todo.id}`);
    sendJson(response, 201, { todo });
    return;
  }

  respondMethodNotAllowed(response, ['GET', 'POST']);
}

async function handleItemRoute(request, response, store, todoId) {
  if (request.method === 'PATCH') {
    const payload = await readJsonBody(request);
    const todo = await store.updateTodo(todoId, payload);

    if (!todo) {
      sendJson(response, 404, { error: 'Todo not found.' });
      return;
    }

    sendJson(response, 200, { todo });
    return;
  }

  if (request.method === 'DELETE') {
    const deletedTodo = await store.deleteTodo(todoId);

    if (!deletedTodo) {
      sendJson(response, 404, { error: 'Todo not found.' });
      return;
    }

    response.writeHead(204);
    response.end();
    return;
  }

  respondMethodNotAllowed(response, ['PATCH', 'DELETE']);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;

    if (size > 1024 * 1024) {
      throw new TypeError('Request body must be 1 MB or smaller.');
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
}

function respondMethodNotAllowed(response, methods) {
  response.setHeader('Allow', methods.join(', '));
  sendJson(response, 405, { error: `Method not allowed. Supported methods: ${methods.join(', ')}.` });
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  response.end(body);
}

function startServer() {
  const port = Number(process.env.PORT) || 3000;
  const dataFilePath = path.join(__dirname, 'data', 'todos.json');
  const store = new TodoStore(dataFilePath);
  const server = createTodoServer({ store });

  server.listen(port, () => {
    process.stdout.write(`Todo demo API listening on http://localhost:${port}\n`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createTodoServer,
  startServer
};
