import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';

describe('Health Check', () => {
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

  it('should return 200 with server and database health (GET /api/health)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(typeof body.version, 'string');
    assert.strictEqual(typeof body.uptimeSeconds, 'number');
    assert.ok(!Number.isNaN(Date.parse(body.timestamp)));
    assert.strictEqual(body.db.status, 'ok');
    // schemaVersion reflects the latest applied migration
    assert.match(body.db.schemaVersion, /^\d{3}_/);
  });

  it('should return 503 when the database is unreachable', async () => {
    app.db.close();

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    assert.strictEqual(response.statusCode, 503);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.status, 'error');
    assert.strictEqual(body.db.status, 'error');
    assert.strictEqual(body.db.schemaVersion, null);
  });
});
