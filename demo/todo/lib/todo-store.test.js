const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { TodoStore } = require('./todo-store');

test('TodoStore persists create, update, and delete operations', async () => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore(path.join(tempDirectory, 'todos.json'));

  assert.deepEqual(await store.listTodos(), []);

  const createdTodo = await store.createTodo({ title: 'Ship backend demo' });
  assert.equal(createdTodo.title, 'Ship backend demo');
  assert.equal(createdTodo.completed, false);
  assert.ok(createdTodo.id);

  const listedTodos = await store.listTodos();
  assert.equal(listedTodos.length, 1);
  assert.equal(listedTodos[0].id, createdTodo.id);

  const updatedTodo = await store.updateTodo(createdTodo.id, {
    title: 'Ship backend demo today',
    completed: true
  });
  assert.equal(updatedTodo.title, 'Ship backend demo today');
  assert.equal(updatedTodo.completed, true);
  assert.notEqual(updatedTodo.updatedAt, createdTodo.updatedAt);

  const deletedTodo = await store.deleteTodo(createdTodo.id);
  assert.equal(deletedTodo.id, createdTodo.id);
  assert.deepEqual(await store.listTodos(), []);
});

test('TodoStore validates write payloads and missing records', async () => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore(path.join(tempDirectory, 'todos.json'));

  await assert.rejects(() => store.createTodo({ title: '   ' }), {
    name: 'TypeError',
    message: 'Todo title must not be empty.'
  });

  await assert.rejects(() => store.updateTodo('todo-1', {}), {
    name: 'TypeError',
    message: 'Todo updates must include title or completed.'
  });

  assert.equal(await store.updateTodo('missing-id', { completed: true }), null);
  assert.equal(await store.deleteTodo('missing-id'), null);
});
