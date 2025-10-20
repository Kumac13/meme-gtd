import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';
import { createTaskFixture } from '../helpers/fixtures.js';

describe('Label Operations', () => {
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

  it('should create a new label (POST /api/labels)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: {
        name: 'urgent',
        description: 'High priority items',
      },
    });

    if (response.statusCode !== 201) {
      console.error('Error response:', response.body);
    }
    assert.strictEqual(response.statusCode, 201);
    const label = JSON.parse(response.body);
    assert.strictEqual(label.name, 'urgent');
    assert.strictEqual(label.description, 'High priority items');
    assert.ok(label.id);
    assert.ok(label.createdAt);
  });

  it('should return 409 when creating duplicate label (UNIQUE constraint)', async () => {
    // Create first label
    await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'urgent' },
    });

    // Try to create duplicate
    const response = await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'urgent' },
    });

    assert.strictEqual(response.statusCode, 409);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'CONFLICT');
    assert.ok(error.message.includes('urgent'));
  });

  it('should list all labels (GET /api/labels)', async () => {
    // Create test labels
    await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'urgent', description: 'High priority' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'bug' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/labels',
    });

    assert.strictEqual(response.statusCode, 200);
    const labels = JSON.parse(response.body);
    assert.ok(Array.isArray(labels));
    assert.strictEqual(labels.length, 2);
    // Labels are ordered by name ASC (alphabetically)
    assert.strictEqual(labels[0].name, 'bug');
    assert.strictEqual(labels[1].name, 'urgent');
  });

  it('should assign label to issue (POST /api/issues/:issueId/labels)', async () => {
    // Create a label
    const labelResponse = await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'urgent' },
    });
    const label = JSON.parse(labelResponse.body);

    // Create a task
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Test Task' }),
    });
    const task = JSON.parse(taskResponse.body);

    // Assign label to task
    const response = await app.inject({
      method: 'POST',
      url: `/api/issues/${task.id}/labels`,
      payload: { labelId: label.id },
    });

    if (response.statusCode !== 200) {
      console.error('Error response:', response.body);
    }
    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.success, true);
  });

  it('should return 404 when assigning label to non-existent issue', async () => {
    // Create a label
    const labelResponse = await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'urgent' },
    });
    const label = JSON.parse(labelResponse.body);

    // Try to assign to non-existent issue
    const response = await app.inject({
      method: 'POST',
      url: '/api/issues/99999/labels',
      payload: { labelId: label.id },
    });

    assert.strictEqual(response.statusCode, 404);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'NOT_FOUND');
  });

  it('should delete a label (DELETE /api/labels/:name)', async () => {
    // Create a label
    await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'urgent' },
    });

    // Delete the label
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/labels/urgent',
    });

    assert.strictEqual(response.statusCode, 204);

    // Verify label is deleted
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/labels',
    });
    const labels = JSON.parse(listResponse.body);
    assert.strictEqual(labels.length, 0);
  });

  it('should return 404 when deleting non-existent label', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/labels/nonexistent',
    });

    assert.strictEqual(response.statusCode, 404);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'NOT_FOUND');
  });
});
