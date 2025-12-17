import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';
import { createTaskFixture, createMemoFixture } from '../helpers/fixtures.js';

describe('URL Link Operations', () => {
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

  describe('POST /api/issues/:id/url-links', () => {
    it('should create a new URL link with title', async () => {
      // Create a task
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture({ title: 'Task with URL' }),
      });
      const task = JSON.parse(taskResponse.body);

      // Create URL link
      const response = await app.inject({
        method: 'POST',
        url: `/api/issues/${task.id}/url-links`,
        payload: {
          url: 'https://github.com/example/repo',
          title: 'GitHub Repository',
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const urlLink = JSON.parse(response.body);
      assert.strictEqual(urlLink.issueId, task.id);
      assert.strictEqual(urlLink.url, 'https://github.com/example/repo');
      assert.strictEqual(urlLink.title, 'GitHub Repository');
      assert.ok(urlLink.id);
      assert.ok(urlLink.createdAt);
    });

    it('should create a URL link without title', async () => {
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture({ title: 'Task' }),
      });
      const task = JSON.parse(taskResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/issues/${task.id}/url-links`,
        payload: {
          url: 'https://docs.example.com/guide',
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const urlLink = JSON.parse(response.body);
      assert.strictEqual(urlLink.url, 'https://docs.example.com/guide');
      assert.strictEqual(urlLink.title, null);
    });

    it('should create URL link for memo', async () => {
      const memoResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        payload: createMemoFixture({ bodyMd: 'Memo with links' }),
      });
      const memo = JSON.parse(memoResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/issues/${memo.id}/url-links`,
        payload: {
          url: 'https://reference.example.com',
          title: 'Reference',
        },
      });

      assert.strictEqual(response.statusCode, 201);
      const urlLink = JSON.parse(response.body);
      assert.strictEqual(urlLink.issueId, memo.id);
    });

    it('should return 400 for invalid URL', async () => {
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture({ title: 'Task' }),
      });
      const task = JSON.parse(taskResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/issues/${task.id}/url-links`,
        payload: {
          url: 'not-a-valid-url',
        },
      });

      assert.strictEqual(response.statusCode, 400);
    });

    it('should return 400 when URL is missing', async () => {
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture({ title: 'Task' }),
      });
      const task = JSON.parse(taskResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/issues/${task.id}/url-links`,
        payload: {
          title: 'Just a title',
        },
      });

      assert.strictEqual(response.statusCode, 400);
    });

    it('should return 404 for non-existent issue', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/issues/99999/url-links',
        payload: {
          url: 'https://example.com',
        },
      });

      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('GET /api/issues/:id/url-links', () => {
    it('should list URL links for an issue', async () => {
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture({ title: 'Task' }),
      });
      const task = JSON.parse(taskResponse.body);

      // Create multiple URL links
      await app.inject({
        method: 'POST',
        url: `/api/issues/${task.id}/url-links`,
        payload: { url: 'https://link1.com', title: 'Link 1' },
      });

      await app.inject({
        method: 'POST',
        url: `/api/issues/${task.id}/url-links`,
        payload: { url: 'https://link2.com', title: 'Link 2' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/issues/${task.id}/url-links`,
      });

      assert.strictEqual(response.statusCode, 200);
      const urlLinks = JSON.parse(response.body);
      assert.ok(Array.isArray(urlLinks));
      assert.strictEqual(urlLinks.length, 2);
    });

    it('should return empty array for issue with no URL links', async () => {
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture({ title: 'Task' }),
      });
      const task = JSON.parse(taskResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/issues/${task.id}/url-links`,
      });

      assert.strictEqual(response.statusCode, 200);
      const urlLinks = JSON.parse(response.body);
      assert.deepStrictEqual(urlLinks, []);
    });

    it('should return 404 for non-existent issue', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/issues/99999/url-links',
      });

      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('DELETE /api/url-links/:id', () => {
    it('should delete a URL link', async () => {
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture({ title: 'Task' }),
      });
      const task = JSON.parse(taskResponse.body);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/issues/${task.id}/url-links`,
        payload: { url: 'https://to-delete.com', title: 'To Delete' },
      });
      const urlLink = JSON.parse(createResponse.body);

      // Delete the URL link
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/url-links/${urlLink.id}`,
      });

      assert.strictEqual(response.statusCode, 204);

      // Verify deletion
      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/issues/${task.id}/url-links`,
      });
      const urlLinks = JSON.parse(listResponse.body);
      assert.strictEqual(urlLinks.length, 0);
    });

    it('should return 404 when deleting non-existent URL link', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/url-links/99999',
      });

      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('Cascade deletion', () => {
    it('should delete URL links when parent issue is deleted', async () => {
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture({ title: 'Task to delete' }),
      });
      const task = JSON.parse(taskResponse.body);

      // Create URL link
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/issues/${task.id}/url-links`,
        payload: { url: 'https://cascade-test.com' },
      });
      const urlLink = JSON.parse(createResponse.body);

      // Delete the task
      await app.inject({
        method: 'DELETE',
        url: `/api/tasks/${task.id}`,
      });

      // URL link should also be deleted (trying to delete should 404)
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/url-links/${urlLink.id}`,
      });
      assert.strictEqual(deleteResponse.statusCode, 404);
    });
  });
});
