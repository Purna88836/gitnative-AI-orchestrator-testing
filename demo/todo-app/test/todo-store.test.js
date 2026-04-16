import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { TodoStore, TodoStoreError } from '../src/todo-store.js';

async function createStoreHarness() {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'todo-store-'));
  const filePath = join(tempDirectory, 'todos.json');

  return {
    filePath,
    store: new TodoStore({ filePath })
  };
}

test('todo store persists create, update, and delete operations', async () => {
  const { filePath, store } = await createStoreHarness();

  const createdTodo = await store.create({ title: 'Write API tests' });

  assert.equal(createdTodo.title, 'Write API tests');
  assert.equal(createdTodo.completed, false);
  assert.ok(createdTodo.id);
  assert.ok(createdTodo.createdAt);
  assert.equal(createdTodo.updatedAt, createdTodo.createdAt);

  assert.deepEqual(await store.list(), [createdTodo]);

  const updatedTodo = await store.update(createdTodo.id, {
    title: 'Write better API tests',
    completed: true
  });

  assert.equal(updatedTodo.title, 'Write better API tests');
  assert.equal(updatedTodo.completed, true);
  assert.ok(updatedTodo.updatedAt);

  const reloadedStore = new TodoStore({ filePath });
  assert.deepEqual(await reloadedStore.list(), [updatedTodo]);

  const removedTodo = await reloadedStore.remove(createdTodo.id);
  assert.equal(removedTodo.id, createdTodo.id);
  assert.deepEqual(await store.list(), []);
});

test('todo store rejects invalid create and update payloads', async () => {
  const { store } = await createStoreHarness();
  const createdTodo = await store.create({ title: 'Valid todo' });

  await assert.rejects(store.create({ title: '   ' }), (error) => {
    assert.ok(error instanceof TodoStoreError);
    assert.equal(error.code, 'INVALID_TITLE');
    return true;
  });

  await assert.rejects(store.update(createdTodo.id, {}), (error) => {
    assert.ok(error instanceof TodoStoreError);
    assert.equal(error.code, 'INVALID_UPDATE');
    return true;
  });

  await assert.rejects(store.update(createdTodo.id, { completed: 'yes' }), (error) => {
    assert.ok(error instanceof TodoStoreError);
    assert.equal(error.code, 'INVALID_COMPLETED');
    return true;
  });

  await assert.rejects(store.update('missing-id', { completed: true }), (error) => {
    assert.ok(error instanceof TodoStoreError);
    assert.equal(error.code, 'TODO_NOT_FOUND');
    return true;
  });
});
