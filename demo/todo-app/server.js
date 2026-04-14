import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTodoHandler } from './src/todo-routes.js';
import { TodoStore } from './src/todo-store.js';

const modulePath = fileURLToPath(import.meta.url);
const moduleDir = dirname(modulePath);
const defaultDataPath = join(moduleDir, 'data', 'todos.json');
const defaultPublicDir = join(moduleDir, 'public');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendPlainText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': Buffer.byteLength(message)
  });
  response.end(message);
}

async function serveStaticAsset(request, response, publicDir) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendPlainText(response, 404, 'Not found');
    return;
  }

  const requestUrl = new URL(request.url, 'http://localhost');
  const assetPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const absolutePublicDir = resolve(publicDir);
  const filePath = resolve(join(absolutePublicDir, `.${assetPath}`));

  if (!filePath.startsWith(`${normalize(absolutePublicDir)}${sep}`)) {
    sendPlainText(response, 404, 'Not found');
    return;
  }

  try {
    const fileBuffer = await readFile(filePath);

    response.writeHead(200, {
      'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'content-length': fileBuffer.byteLength
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    response.end(fileBuffer);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      sendPlainText(response, 404, 'Not found');
      return;
    }

    console.error('Failed to serve static asset', error);
    sendPlainText(response, 500, 'Internal server error');
  }
}

export function createAppServer({
  store = new TodoStore({ filePath: defaultDataPath }),
  publicDir = defaultPublicDir
} = {}) {
  const handleTodoRequest = createTodoHandler({ store });

  return createServer(async (request, response) => {
    try {
      if (await handleTodoRequest(request, response)) {
        return;
      }

      await serveStaticAsset(request, response, publicDir);
    } catch (error) {
      console.error('Unexpected server error', error);
      sendPlainText(response, 500, 'Internal server error');
    }
  });
}

if (process.argv[1] === modulePath) {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const server = createAppServer();

  server.listen(port, () => {
    console.log(`Todo demo server listening on http://localhost:${port}`);
  });
}
