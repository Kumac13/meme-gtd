import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import type { MgtdConfig } from 'meme-gtd-config';
import { ensureDatabase } from 'meme-gtd-db';
import { startBackupScheduler } from '../../src/services/backupScheduler.js';
import { loadConfig } from '../../src/config.js';

const stubLogger = (sink?: { errors: unknown[] }): FastifyBaseLogger => {
  const noop = () => undefined;
  return {
    info: noop,
    warn: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    error: (...args: unknown[]) => {
      sink?.errors.push(args);
    },
    silent: noop,
    level: 'silent',
    child: () => stubLogger(sink),
  } as unknown as FastifyBaseLogger;
};

const setupDb = (): { tmpDir: string; dbPath: string } => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'mgtd-backup-sched-'));
  const dbPath = join(tmpDir, 'test.db');
  const config: MgtdConfig = { dbPath, mode: 'local', schemaVersion: '001_init' };
  const db = ensureDatabase(config);
  db.close();
  return { tmpDir, dbPath };
};

const countBackups = (backupDir: string): number =>
  existsSync(backupDir) ? readdirSync(backupDir).length : 0;

describe('Backup scheduler', () => {
  it('takes an initial backup when none exists and repeats on the interval', async () => {
    const { tmpDir, dbPath } = setupDb();
    const backupDir = join(tmpDir, 'backups');
    const logger = stubLogger();

    const scheduler = startBackupScheduler({
      dbPath,
      backupDir,
      keep: 10,
      intervalMs: 300,
      logger,
    });

    try {
      // Initial backup (no previous backup exists)
      const deadline = Date.now() + 10_000;
      while (countBackups(backupDir) < 1 && Date.now() < deadline) {
        await delay(50);
      }
      assert.ok(countBackups(backupDir) >= 1, 'expected an initial backup');

      // At least one more backup on the interval
      while (countBackups(backupDir) < 2 && Date.now() < deadline) {
        await delay(50);
      }
      assert.ok(countBackups(backupDir) >= 2, 'expected a periodic backup');
    } finally {
      scheduler.stop();
    }

    // After stop, no further backups are taken. A backup that started just
    // before stop() may still be in flight, so let it settle first.
    await delay(500);
    const countAfterStop = countBackups(backupDir);
    await delay(700);
    assert.equal(countBackups(backupDir), countAfterStop);
  });

  it('logs an error but does not throw when the database is missing', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'mgtd-backup-sched-missing-'));
    const dbPath = join(tmpDir, 'missing.db');
    const backupDir = join(tmpDir, 'backups');
    const errors: unknown[] = [];
    const logger = stubLogger({ errors });

    const scheduler = startBackupScheduler({
      dbPath,
      backupDir,
      intervalMs: 60_000,
      logger,
    });

    try {
      const deadline = Date.now() + 5_000;
      while (errors.length === 0 && Date.now() < deadline) {
        await delay(50);
      }
      assert.ok(errors.length > 0, 'expected a logged backup failure');
      assert.equal(countBackups(backupDir), 0);
      assert.equal(existsSync(dbPath), false, 'must not create an empty database');
    } finally {
      scheduler.stop();
    }
  });

  it('parses backup environment variables with defaults', async () => {
    const saved = {
      enabled: process.env.MGTD_BACKUP_ENABLED,
      interval: process.env.MGTD_BACKUP_INTERVAL_HOURS,
      keep: process.env.MGTD_BACKUP_KEEP,
      dir: process.env.MGTD_BACKUP_DIR,
    };
    try {
      process.env.MGTD_CONFIG_PATH = join(
        mkdtempSync(join(tmpdir(), 'mgtd-backup-config-')),
        'context.json'
      );
      process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'mgtd-backup-db-')), 'test.db');

      delete process.env.MGTD_BACKUP_ENABLED;
      delete process.env.MGTD_BACKUP_INTERVAL_HOURS;
      delete process.env.MGTD_BACKUP_KEEP;
      delete process.env.MGTD_BACKUP_DIR;

      const defaults = await loadConfig();
      assert.deepEqual(defaults.backup, {
        enabled: true,
        intervalHours: 24,
        keep: 7,
        backupDir: undefined,
      });

      process.env.MGTD_BACKUP_ENABLED = 'false';
      process.env.MGTD_BACKUP_INTERVAL_HOURS = '6';
      process.env.MGTD_BACKUP_KEEP = '14';
      process.env.MGTD_BACKUP_DIR = '/tmp/mgtd-backups';
      const custom = await loadConfig();
      assert.deepEqual(custom.backup, {
        enabled: false,
        intervalHours: 6,
        keep: 14,
        backupDir: '/tmp/mgtd-backups',
      });

      process.env.MGTD_BACKUP_INTERVAL_HOURS = 'not-a-number';
      process.env.MGTD_BACKUP_KEEP = '-1';
      const invalid = await loadConfig();
      assert.equal(invalid.backup.intervalHours, 24);
      assert.equal(invalid.backup.keep, 7);
    } finally {
      for (const [key, value] of Object.entries({
        MGTD_BACKUP_ENABLED: saved.enabled,
        MGTD_BACKUP_INTERVAL_HOURS: saved.interval,
        MGTD_BACKUP_KEEP: saved.keep,
        MGTD_BACKUP_DIR: saved.dir,
      })) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
