import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';

describe('Logging', () => {
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

  it('should have logging hooks registered (smoke test)', async () => {
    // Simply verify that requests complete successfully with logging enabled
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos',
    });

    assert.strictEqual(response.statusCode, 200);
    // If logging hooks cause errors, the request would fail
  });

  it('should not crash on errors with logging enabled', async () => {
    // Verify logging works during error conditions
    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks/99999',
    });

    assert.strictEqual(response.statusCode, 404);
    // If logging hooks cause errors during error handling, the request would fail
  });

  it('should handle requests with custom user-agent', async () => {
    // Verify logging works with various headers
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos',
      headers: {
        'user-agent': 'test-client/1.0',
      },
    });

    assert.strictEqual(response.statusCode, 200);
  });
});
