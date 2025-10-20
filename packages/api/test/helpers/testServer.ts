import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type { MgtdConfig } from 'meme-gtd-config';
import { ensureDatabase } from 'meme-gtd-db';
import { buildApp } from '../../src/server.js';

export interface TestServerOptions {
  corsAllowedOrigins?: string[];
  captureLog?: boolean;
}

export interface LogMessage {
  level: number;
  msg?: string;
  [key: string]: any;
}

/**
 * Create a writable stream that captures log messages
 */
function createLogStream(logs: LogMessage[]): Writable {
  let buffer = '';
  return new Writable({
    objectMode: false,
    write(chunk, _encoding, callback) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        try {
          logs.push(JSON.parse(trimmed));
        } catch {
          // Ignore parse errors from partial lines; remaining data stays in buffer
        }
      }
      callback();
    },
    final(callback) {
      const trimmed = buffer.trim();
      if (trimmed) {
        try {
          logs.push(JSON.parse(trimmed));
        } catch {
          // ignore final partial line
        }
      }
      callback();
    },
  });
}

/**
 * Create a test server instance with a temporary database
 * @returns Fastify instance, cleanup function, and optional log messages
 */
export async function createTestServer(
  options: TestServerOptions = {}
): Promise<{ app: FastifyInstance; cleanup: () => Promise<void>; logs?: LogMessage[] }> {
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

  // Prepare log capture if requested
  const logs: LogMessage[] = [];
  const logStream = options.captureLog ? createLogStream(logs) : undefined;

  // Build app with test configuration
  const app = await buildApp({
    config,
    corsAllowedOrigins: options.corsAllowedOrigins ?? ['*'],
    logger: logStream
      ? {
          level: 'info',
          stream: logStream,
        }
      : {
          level: 'error',
          prettyPrint: true,
        },
  });

  // Cleanup function to close server and remove temp directory
  const cleanup = async () => {
    await app.close();
    if (logStream) {
      logStream.end();
    }
    // Note: In a real implementation, you might want to recursively delete tmpDir
    // For simplicity, we're leaving it to the OS to clean up /tmp
  };

  return { app, cleanup, logs: options.captureLog ? logs : undefined };
}
