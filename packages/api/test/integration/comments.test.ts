import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';
import { createMemoFixture } from '../helpers/fixtures.js';

describe('Memo Comment Operations', () => {
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

  it('should create comment on memo (POST /api/memos/:memoId/comments)', async () => {
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(memoResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'Test comment' },
    });

    assert.strictEqual(response.statusCode, 201);
    const comment = JSON.parse(response.body);
    assert.strictEqual(comment.bodyMd, 'Test comment');
    assert.strictEqual(comment.issueId, memo.id);
    assert.ok(comment.id);
    assert.ok(comment.createdAt);
  });

  it('should return 400 when creating comment with empty body', async () => {
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(memoResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: '' },
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it('should list comments for memo (GET /api/memos/:memoId/comments)', async () => {
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(memoResponse.body);

    // Create comments
    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'Comment 1' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'Comment 2' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/memos/${memo.id}/comments`,
    });

    assert.strictEqual(response.statusCode, 200);
    const comments = JSON.parse(response.body);
    assert.ok(Array.isArray(comments));
    assert.strictEqual(comments.length, 2);
  });

  it('should update comment (PATCH /api/memos/:memoId/comments/:commentId)', async () => {
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(memoResponse.body);

    const commentResponse = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'Original comment' },
    });
    const comment = JSON.parse(commentResponse.body);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/memos/${memo.id}/comments/${comment.id}`,
      payload: { bodyMd: 'Updated comment' },
    });

    assert.strictEqual(response.statusCode, 200);
    const updated = JSON.parse(response.body);
    assert.strictEqual(updated.bodyMd, 'Updated comment');
    assert.strictEqual(updated.id, comment.id);
  });

  it('should delete comment (DELETE /api/memos/:memoId/comments/:commentId)', async () => {
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(memoResponse.body);

    const commentResponse = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'Comment to delete' },
    });
    const comment = JSON.parse(commentResponse.body);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/memos/${memo.id}/comments/${comment.id}`,
    });

    assert.strictEqual(deleteResponse.statusCode, 204);

    // Verify comment is deleted
    const listResponse = await app.inject({
      method: 'GET',
      url: `/api/memos/${memo.id}/comments`,
    });

    const comments = JSON.parse(listResponse.body);
    assert.strictEqual(comments.length, 0);
  });

  it('should return 404 when creating comment on non-existent memo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos/99999/comments',
      payload: { bodyMd: 'Test' },
    });

    assert.strictEqual(response.statusCode, 404);
  });

  it('should return 404 when updating non-existent comment', async () => {
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(memoResponse.body);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/memos/${memo.id}/comments/99999`,
      payload: { bodyMd: 'Updated' },
    });

    assert.strictEqual(response.statusCode, 404);
  });

  it('should return 404 when deleting non-existent comment', async () => {
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(memoResponse.body);

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/memos/${memo.id}/comments/99999`,
    });

    assert.strictEqual(response.statusCode, 404);
  });
});
