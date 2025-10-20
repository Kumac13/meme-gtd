import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';
import { createTaskFixture } from '../helpers/fixtures.js';

describe('Error Handling', () => {
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

  it('should return 404 for non-existent route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/nonexistent',
    });

    assert.strictEqual(response.statusCode, 404);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'NOT_FOUND');
    assert.ok(error.message.includes('Route'));
  });

  it('should return canonical not found message for missing memo', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos/99999',
    });

    assert.strictEqual(response.statusCode, 404);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.message, 'Memo #99999 not found');
  });

  it('should return 404 for non-existent resource', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks/99999',
    });

    assert.strictEqual(response.statusCode, 404);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'NOT_FOUND');
    assert.ok(error.message.includes('Task'));
  });

  it('should return 400 for validation error (missing required field)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {}, // Missing title
    });

    if (response.statusCode !== 400) {
      console.error('Unexpected response:', response.statusCode, response.body);
    }
    assert.strictEqual(response.statusCode, 400);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
    // Details field should exist (either details or validation)
    assert.ok(error.details || error.message, 'Should have error details or message');
  });

  it('should return 400 for validation error (invalid type)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        title: 'Test',
        status: 'invalid_status', // Invalid enum value
      },
    });

    assert.strictEqual(response.statusCode, 400);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
  });

  it('should return 400 for validation error (self-referencing link)', async () => {
    // Create a task
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 1' }),
    });
    const task = JSON.parse(taskResponse.body);

    // Try to create self-link
    const response = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task.id,
        targetIssueId: task.id,
        linkType: 'relates',
      },
    });

    assert.strictEqual(response.statusCode, 400);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
  });

  it('should return 409 for conflict (duplicate label)', async () => {
    // Create first label
    await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'duplicate-test' },
    });

    // Try to create duplicate
    const response = await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'duplicate-test' },
    });

    assert.strictEqual(response.statusCode, 409);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'CONFLICT');
  });

  it('should return 413 for request body exceeding size limit', async () => {
    // Create a payload larger than 10MB
    const largeBody = 'x'.repeat(11 * 1024 * 1024); // 11MB

    const response = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: largeBody },
      headers: {
        'content-type': 'application/json',
      },
    });

    assert.strictEqual(response.statusCode, 413);
  });

  it('should not leak stack traces in production-like errors', async () => {
    // Force an error by requesting non-existent resource
    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks/99999',
    });

    const error = JSON.parse(response.body);
    // 404 errors should not include stack traces even in non-production
    assert.strictEqual(error.stack, undefined);
  });

  it('should handle malformed JSON gracefully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: '{invalid json}',
      headers: {
        'content-type': 'application/json',
      },
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it('should return structured error response format', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks/99999',
    });

    const error = JSON.parse(response.body);
    assert.ok(error.error); // Error name
    assert.ok(error.code); // Error code
    assert.ok(error.message); // Error message
  });
});
