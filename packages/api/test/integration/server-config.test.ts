import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';

describe('Server configuration', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  it('applies default request timeout of 30 seconds', async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;

    const httpServer = app.server as { requestTimeout?: number; options?: { requestTimeout?: number } };
    const requestTimeout = httpServer.requestTimeout ?? httpServer.options?.requestTimeout;
    assert.strictEqual(requestTimeout, 30_000);
  });
});
