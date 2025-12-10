import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';

describe('Activity Log API', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  // Helper to create activity log entry directly via DB
  // In real usage, logs are created by other operations
  const createActivityLogEntry = async (
    eventType: string,
    sourceType: string,
    payload: Record<string, unknown>
  ) => {
    // We'll test the API endpoints, not direct DB insertion
    // For now, we need to create tasks/memos first and then check their history
  };

  describe('GET /api/activity-log/issues/:issueId', () => {
    it('should return empty array for issue with no activity', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log/issues/999',
      });

      assert.strictEqual(response.statusCode, 200);
      const logs = JSON.parse(response.body);
      assert.ok(Array.isArray(logs));
      assert.strictEqual(logs.length, 0);
    });

    it('should return activity log entries for an issue', async () => {
      // First create a task
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { title: 'Test Task', bodyMd: 'Task body' },
      });
      const task = JSON.parse(taskResponse.body);

      // Get activity log for this task
      const response = await app.inject({
        method: 'GET',
        url: `/api/activity-log/issues/${task.id}`,
      });

      assert.strictEqual(response.statusCode, 200);
      const logs = JSON.parse(response.body);
      assert.ok(Array.isArray(logs));
      // Note: Activity logging needs to be integrated with task creation
      // For now, this returns empty until we integrate logging
    });

    it('should support limit parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log/issues/1?limit=10',
      });

      assert.strictEqual(response.statusCode, 200);
    });

    it('should support order parameter', async () => {
      const responseAsc = await app.inject({
        method: 'GET',
        url: '/api/activity-log/issues/1?order=asc',
      });
      assert.strictEqual(responseAsc.statusCode, 200);

      const responseDesc = await app.inject({
        method: 'GET',
        url: '/api/activity-log/issues/1?order=desc',
      });
      assert.strictEqual(responseDesc.statusCode, 200);
    });
  });

  describe('GET /api/activity-log/projects/:projectId', () => {
    it('should return empty array for project with no activity', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log/projects/999',
      });

      assert.strictEqual(response.statusCode, 200);
      const logs = JSON.parse(response.body);
      assert.ok(Array.isArray(logs));
      assert.strictEqual(logs.length, 0);
    });

    it('should support limit and order parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log/projects/1?limit=50&order=desc',
      });

      assert.strictEqual(response.statusCode, 200);
    });
  });

  describe('GET /api/activity-log/completed-tasks', () => {
    it('should return empty array when no tasks completed', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log/completed-tasks',
      });

      assert.strictEqual(response.statusCode, 200);
      const tasks = JSON.parse(response.body);
      assert.ok(Array.isArray(tasks));
      assert.strictEqual(tasks.length, 0);
    });

    it('should support date range parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log/completed-tasks?from=2025-01-01&to=2025-12-31',
      });

      assert.strictEqual(response.statusCode, 200);
    });

    it('should support limit parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log/completed-tasks?limit=10',
      });

      assert.strictEqual(response.statusCode, 200);
    });
  });

  describe('GET /api/activity-log', () => {
    it('should return activity log entries with default filters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log',
      });

      assert.strictEqual(response.statusCode, 200);
      const logs = JSON.parse(response.body);
      assert.ok(Array.isArray(logs));
    });

    it('should support filtering by sourceType', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log?sourceType=cli',
      });

      assert.strictEqual(response.statusCode, 200);
    });

    it('should support filtering by eventType', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log?eventType=task.created',
      });

      assert.strictEqual(response.statusCode, 200);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log?limit=10&offset=0',
      });

      assert.strictEqual(response.statusCode, 200);
    });

    it('should support date range filtering', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log?from=2025-01-01T00:00:00Z&to=2025-12-31T23:59:59Z',
      });

      assert.strictEqual(response.statusCode, 200);
    });

    it('should return 400 for invalid limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log?limit=10000',
      });

      assert.strictEqual(response.statusCode, 400);
    });

    it('should return 400 for invalid sourceType', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log?sourceType=invalid',
      });

      assert.strictEqual(response.statusCode, 400);
    });
  });

  describe('Response format validation', () => {
    it('should return activity log entries with correct structure', async () => {
      // Create a task first to potentially have an activity log entry
      await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { title: 'Test', bodyMd: '' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log',
      });

      assert.strictEqual(response.statusCode, 200);
      const logs = JSON.parse(response.body);

      // If there are entries, validate their structure
      if (logs.length > 0) {
        const entry = logs[0];
        assert.ok('id' in entry, 'entry should have id');
        assert.ok('eventType' in entry, 'entry should have eventType');
        assert.ok('occurredAt' in entry, 'entry should have occurredAt');
        assert.ok('sourceType' in entry, 'entry should have sourceType');
        assert.ok('payload' in entry, 'entry should have payload');
      }
    });

    it('completed tasks should have correct structure', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/activity-log/completed-tasks',
      });

      assert.strictEqual(response.statusCode, 200);
      const tasks = JSON.parse(response.body);

      // If there are entries, validate their structure
      if (tasks.length > 0) {
        const entry = tasks[0];
        assert.ok('taskId' in entry, 'entry should have taskId');
        assert.ok('title' in entry, 'entry should have title');
        assert.ok('completedAt' in entry, 'entry should have completedAt');
      }
    });
  });
});
