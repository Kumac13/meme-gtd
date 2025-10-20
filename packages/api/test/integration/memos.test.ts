import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';
import { createMemoFixture } from '../helpers/fixtures.js';

describe('Memo CRUD Operations', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const testServer = await createTestServer();
    app = testServer.app;
    cleanup = testServer.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should create a new memo (POST /api/memos)', async () => {
    const memoData = createMemoFixture({ bodyMd: 'Test memo content' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: memoData,
    });

    if (response.statusCode !== 201) {
      console.error('Error response:', response.body);
    }
    assert.strictEqual(response.statusCode, 201);
    const memo = JSON.parse(response.body);
    assert.strictEqual(memo.type, 'memo');
    assert.strictEqual(memo.bodyMd, 'Test memo content');
    assert.strictEqual(memo.isBookmarked, false);
    assert.ok(memo.id);
    assert.ok(memo.createdAt);
    assert.ok(memo.updatedAt);
  });

  it('should return 400 when creating memo with empty body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: '' },
    });

    assert.strictEqual(response.statusCode, 400);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
  });

  it('should list all memos (GET /api/memos)', async () => {
    // Create test memos
    await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Memo 1' }),
    });
    await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Memo 2' }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/memos',
    });

    assert.strictEqual(response.statusCode, 200);
    const memos = JSON.parse(response.body);
    assert.ok(Array.isArray(memos));
    assert.strictEqual(memos.length, 2);
  });

  it('should filter bookmarked memos (GET /api/memos?bookmarked=true)', async () => {
    // Create memo and bookmark it
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(createResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/bookmark`,
    });

    // Create another non-bookmarked memo
    await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/memos?bookmarked=true',
    });

    assert.strictEqual(response.statusCode, 200);
    const memos = JSON.parse(response.body);
    assert.strictEqual(memos.length, 1);
    assert.strictEqual(memos[0].isBookmarked, true);
  });

  it('should get memo by ID (GET /api/memos/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Specific memo' }),
    });
    const created = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/memos/${created.id}`,
    });

    assert.strictEqual(response.statusCode, 200);
    const memo = JSON.parse(response.body);
    assert.strictEqual(memo.id, created.id);
    assert.strictEqual(memo.bodyMd, 'Specific memo');
  });

  it('should return 404 when memo not found (GET /api/memos/:id)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos/99999',
    });

    assert.strictEqual(response.statusCode, 404);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'NOT_FOUND');
  });

  it('should update memo (PATCH /api/memos/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Original content' }),
    });
    const memo = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/memos/${memo.id}`,
      payload: { bodyMd: 'Updated content' },
    });

    assert.strictEqual(response.statusCode, 200);
    const updated = JSON.parse(response.body);
    assert.strictEqual(updated.bodyMd, 'Updated content');
    assert.strictEqual(updated.id, memo.id);
  });

  it('should delete memo (DELETE /api/memos/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(createResponse.body);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/memos/${memo.id}`,
    });

    assert.strictEqual(deleteResponse.statusCode, 204);

    // Verify memo is deleted (soft delete)
    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/memos/${memo.id}`,
    });

    assert.strictEqual(getResponse.statusCode, 404);
  });
});

describe('Memo Promote Operation', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const testServer = await createTestServer();
    app = testServer.app;
    cleanup = testServer.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should promote memo to task (POST /api/memos/:id/promote)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Memo to promote' }),
    });
    const memo = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/promote`,
      payload: { title: 'Promoted Task', status: 'next' },
    });

    assert.strictEqual(response.statusCode, 200);
    const task = JSON.parse(response.body);
    assert.strictEqual(task.type, 'task');
    assert.strictEqual(task.title, 'Promoted Task');
    assert.strictEqual(task.status, 'next');
    assert.strictEqual(task.bodyMd, 'Memo to promote');
  });

  it('should return 400 when promoting without title', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/promote`,
      payload: {},
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it('should return 404 when promoting non-existent memo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos/99999/promote',
      payload: { title: 'Test' },
    });

    assert.strictEqual(response.statusCode, 404);
  });
});

describe('Memo Bookmark Operations', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const testServer = await createTestServer();
    app = testServer.app;
    cleanup = testServer.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should bookmark a memo (POST /api/memos/:id/bookmark)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/bookmark`,
    });

    assert.strictEqual(response.statusCode, 200);
    const bookmarked = JSON.parse(response.body);
    assert.strictEqual(bookmarked.isBookmarked, true);
    assert.strictEqual(bookmarked.id, memo.id);
  });

  it('should unbookmark a memo (POST /api/memos/:id/unbookmark)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(createResponse.body);

    // First bookmark it
    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/bookmark`,
    });

    // Then unbookmark
    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/unbookmark`,
    });

    assert.strictEqual(response.statusCode, 200);
    const unbookmarked = JSON.parse(response.body);
    assert.strictEqual(unbookmarked.isBookmarked, false);
  });

  it('should return 404 when bookmarking non-existent memo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos/99999/bookmark',
    });

    assert.strictEqual(response.statusCode, 404);
  });

  it('should return 404 when unbookmarking non-existent memo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos/99999/unbookmark',
    });

    assert.strictEqual(response.statusCode, 404);
  });
});
