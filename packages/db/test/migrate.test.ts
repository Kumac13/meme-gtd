import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase } from '../src/index';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-migratetest-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

test('calendar datetime indexes exist after full migration', () => {
  // Migration 010 rebuilds the issues table and used to drop the calendar
  // indexes created by 007; migration 014 restores them.
  const { dir, db } = createTempDb();
  try {
    const indexNames = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='issues'")
      .all()
      .map((row) => (row as { name: string }).name);

    assert.ok(indexNames.includes('idx_issues_scheduled_start'), indexNames.join(', '));
    assert.ok(indexNames.includes('idx_issues_scheduled_end'), indexNames.join(', '));
    assert.ok(indexNames.includes('idx_issues_actual_start'), indexNames.join(', '));
  } finally {
    db.close();
    fs.removeSync(dir);
  }
});

test('applyMigrations is idempotent and records every version', () => {
  const { dir, dbPath } = createTempDb();
  try {
    const rerun = applyMigrations(dbPath);
    assert.equal(rerun.applied.length, 0);
    assert.ok(rerun.skipped.includes('014_restore_calendar_indexes'));

    const db = openDatabase({ dbPath });
    const versions = db
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all()
      .map((row) => (row as { version: string }).version);
    db.close();

    assert.ok(versions.includes('010_update_issues_type_check'));
    assert.ok(versions.includes('014_restore_calendar_indexes'));
  } finally {
    fs.removeSync(dir);
  }
});
