import { TodoStoreError } from './todo-store.js';

function writeJson(response, statusCode, payload) {
  const responseBody = JSON.stringify(payload);

  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(responseBody)
  });
  response.end(responseBody);
}

function writeError(response, statusCode, code, message) {
  writeJson(response, statusCode, {
    error: {
      code,
      message
    }
  });
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    throw new TodoStoreError('Request body must be valid JSON.', {
      code: 'INVALID_JSON',
      status: 400,
      cause: error
    });
  }
}

export function createTodoHandler({ store }) {
  if (!store) {
    throw new TypeError('store is required');
  }

  return async function handleTodoRequest(request, response) {
    const url = new URL(request.url, 'http://localhost');

    if (!url.pathname.startsWith('/api/todos')) {
      return false;
    }

    try {
      if (url.pathname === '/api/todos') {
        if (request.method === 'GET') {
          const todos = await store.list();
          writeJson(response, 200, { todos });
          return true;
        }

        if (request.method === 'POST') {
          const payload = await readJsonBody(request);
          const todo = await store.create(payload);
          writeJson(response, 201, { todo });
          return true;
        }

        writeError(response, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
        return true;
      }

      const pathMatch = url.pathname.match(/^\/api\/todos\/([^/]+)$/);

      if (!pathMatch) {
        writeError(response, 404, 'ROUTE_NOT_FOUND', 'Route not found.');
        return true;
      }

      const [, todoId] = pathMatch;

      if (request.method === 'PATCH') {
        const payload = await readJsonBody(request);
        const todo = await store.update(todoId, payload);
        writeJson(response, 200, { todo });
        return true;
      }

      if (request.method === 'DELETE') {
        await store.remove(todoId);
        response.writeHead(204);
        response.end();
        return true;
      }

      writeError(response, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      return true;
    } catch (error) {
      if (error instanceof TodoStoreError) {
        writeError(response, error.status, error.code, error.message);
        return true;
      }

      console.error('Todo route error', error);
      writeError(response, 500, 'INTERNAL_SERVER_ERROR', 'Internal server error.');
      return true;
    }
  };
}
