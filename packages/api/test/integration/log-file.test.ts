import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdtempSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { MgtdConfig } from 'meme-gtd-config';
import { ensureDatabase } from 'meme-gtd-db';
import { buildApp } from '../../src/server.js';
import { loadConfig } from '../../src/config.js';

describe('Log file output (MGTD_LOG_FILE)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('parses MGTD_LOG_FILE from the environment', async () => {
    const original = process.env.MGTD_LOG_FILE;
    try {
      process.env.MGTD_LOG_FILE = '/tmp/mgtd-test/api.log';
      process.env.MGTD_CONFIG_PATH = join(
        mkdtempSync(join(tmpdir(), 'mgtd-logfile-config-')),
        'context.json'
      );
      process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'mgtd-logfile-db-')), 'test.db');
      const config = await loadConfig();
      assert.strictEqual(config.logFile, '/tmp/mgtd-test/api.log');

      process.env.MGTD_LOG_FILE = '   ';
      const blank = await loadConfig();
      assert.strictEqual(blank.logFile, undefined);
    } finally {
      if (original === undefined) {
        delete process.env.MGTD_LOG_FILE;
      } else {
        process.env.MGTD_LOG_FILE = original;
      }
    }
  });

  it('writes request logs to the rotating log file when logFile is set', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'mgtd-logfile-test-'));
    const dbPath = join(tmpDir, 'test.db');
    const logFile = join(tmpDir, 'logs', 'api.log');
    const logDir = dirname(logFile);

    const config: MgtdConfig = {
      dbPath,
      mode: 'local',
      schemaVersion: '001_init',
    };
    const db = ensureDatabase(config);
    db.close();

    app = await buildApp({
      config,
      logger: { level: 'info', logFile },
    });

    const response = await app.inject({ method: 'GET', url: '/api/health' });
    assert.strictEqual(response.statusCode, 200);

    // The transport worker flushes asynchronously; poll for the log entry
    const findEntry = (): Record<string, unknown> | undefined => {
      if (!existsSync(logDir)) {
        return undefined;
      }
      const contents = readdirSync(logDir)
        .map((file) => readFileSync(join(logDir, file), 'utf-8'))
        .join('');
      return contents
        .split('\n')
        .filter(Boolean)
        .map((raw) => JSON.parse(raw) as Record<string, unknown>)
        .find((entry) => typeof entry.url === 'string' && entry.url === '/api/health');
    };

    let entry: Record<string, unknown> | undefined;
    const deadline = Date.now() + 10_000;
    while (!entry && Date.now() < deadline) {
      await delay(100);
      entry = findEntry();
    }

    assert.ok(entry, 'expected a request log entry for /api/health in the log file');
  });
});
