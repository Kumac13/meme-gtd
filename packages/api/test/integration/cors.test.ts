import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';

describe('CORS Configuration', () => {
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

  it('should handle preflight OPTIONS request', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/memos',
      headers: {
        origin: 'http://localhost:3001',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    assert.strictEqual(response.statusCode, 204);
    assert.ok(response.headers['access-control-allow-origin']);
    assert.ok(response.headers['access-control-allow-methods']);
    assert.ok(response.headers['access-control-allow-headers']);
  });

  it('should allow requests without origin (mobile apps, curl)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos',
      // No origin header
    });

    assert.strictEqual(response.statusCode, 200);
  });

  it('should include CORS headers in actual request', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos',
      headers: {
        origin: 'http://localhost:3001',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(response.headers['access-control-allow-origin']);
  });

  it('should support credentials', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos',
      headers: {
        origin: 'http://localhost:3001',
      },
    });

    assert.strictEqual(response.headers['access-control-allow-credentials'], 'true');
  });

  it('should allow all configured methods', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/memos',
      headers: {
        origin: 'http://localhost:3001',
        'access-control-request-method': 'DELETE',
      },
    });

    const allowedMethods = response.headers['access-control-allow-methods'] as string;
    assert.ok(allowedMethods.includes('GET'));
    assert.ok(allowedMethods.includes('POST'));
    assert.ok(allowedMethods.includes('PATCH'));
    assert.ok(allowedMethods.includes('DELETE'));
    assert.ok(allowedMethods.includes('OPTIONS'));
  });
});
