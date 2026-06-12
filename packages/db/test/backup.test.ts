import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  createBackup,
  listBackups,
  pruneBackups,
  latestBackupTime,
  defaultBackupDir
} from '../src/backup.js';
import { applyMigrations, openDatabase } from '../src/index.js';

const setupDb = (): { dir: string; dbPath: string } => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-backup-test-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  return { dir, dbPath };
};

test('createBackup produces a restorable snapshot including uncheckpointed WAL writes', async () => {
  const { dbPath } = setupDb();

  // Write through a WAL connection and keep it open so the WAL is not
  // checkpointed before the backup runs
  const db = openDatabase({ dbPath });
  db.prepare(
    "INSERT INTO issues (type, title, body_md) VALUES ('memo', 'wal memo', 'written before backup')"
  ).run();

  const result = await createBackup(dbPath);
  db.close();

  assert.ok(fs.existsSync(result.backupPath));
  assert.ok(result.sizeBytes > 0);

  const restored = new Database(result.backupPath, { readonly: true });
  const row = restored
    .prepare("SELECT title FROM issues WHERE title = 'wal memo'")
    .get() as { title: string } | undefined;
  restored.close();
  assert.equal(row?.title, 'wal memo');
});

test('createBackup uses <db dir>/backups by default', async () => {
  const { dir, dbPath } = setupDb();
  const result = await createBackup(dbPath);
  assert.equal(path.dirname(result.backupPath), path.join(dir, 'backups'));
  assert.equal(defaultBackupDir(dbPath), path.join(dir, 'backups'));
});

test('createBackup fails on a missing database and creates no empty file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-backup-missing-'));
  const dbPath = path.join(dir, 'does-not-exist.db');

  await assert.rejects(createBackup(dbPath));
  assert.equal(fs.existsSync(dbPath), false);
  assert.equal(fs.existsSync(path.join(dir, 'backups')), false);
});

test('pruneBackups keeps the newest N backups and ignores unrelated files', async () => {
  const { dir, dbPath } = setupDb();
  const backupDir = path.join(dir, 'backups');

  for (let i = 0; i < 4; i += 1) {
    await createBackup(dbPath, { keep: 0 });
  }
  const unrelated = path.join(backupDir, 'keep-me.txt');
  fs.writeFileSync(unrelated, 'not a backup');

  const pruned = await pruneBackups(backupDir, 2);
  assert.equal(pruned.length, 2);

  const remaining = await listBackups(backupDir);
  assert.equal(remaining.length, 2);
  assert.ok(fs.existsSync(unrelated));
});

test('createBackup prunes automatically with the keep option', async () => {
  const { dir, dbPath } = setupDb();
  await createBackup(dbPath, { keep: 1 });
  const second = await createBackup(dbPath, { keep: 1 });

  assert.equal(second.prunedFiles.length, 1);
  const remaining = await listBackups(path.join(dir, 'backups'));
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].path, second.backupPath);
});

test('latestBackupTime returns null without backups and a date after one', async () => {
  const { dir, dbPath } = setupDb();
  const backupDir = path.join(dir, 'backups');

  assert.equal(await latestBackupTime(backupDir), null);
  await createBackup(dbPath);
  const latest = await latestBackupTime(backupDir);
  assert.ok(latest instanceof Date);
});
