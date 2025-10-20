import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { MgtdConfig } from 'meme-gtd-config';
import { ensureDatabase } from 'meme-gtd-db';
import { buildApp } from '../../src/server.js';

export interface TestServerOptions {
  corsAllowedOrigins?: string[];
}

/**
 * Create a test server instance with a temporary database
 * @returns Fastify instance and cleanup function
 */
export async function createTestServer(
  options: TestServerOptions = {}
): Promise<{ app: FastifyInstance; cleanup: () => Promise<void> }> {
  // Create temporary directory for test database
  const tmpDir = mkdtempSync(join(tmpdir(), 'mgtd-api-test-'));
  const dbPath = join(tmpDir, 'test.db');

  // Initialize database
  const config: MgtdConfig = {
    dbPath,
    mode: 'local',
    schemaVersion: '001_init',
  };

  const db = ensureDatabase(config);
  db.close();

  // Build app with test configuration
  const app = await buildApp({
    config,
    corsAllowedOrigins: options.corsAllowedOrigins ?? ['*'],
    logger: {
      level: 'silent', // Disable logging in tests
      prettyPrint: false,
    },
  });

  // Cleanup function to close server and remove temp directory
  const cleanup = async () => {
    await app.close();
    // Note: In a real implementation, you might want to recursively delete tmpDir
    // For simplicity, we're leaving it to the OS to clean up /tmp
  };

  return { app, cleanup };
}
