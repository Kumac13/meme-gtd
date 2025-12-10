import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase } from '../src/index.js';
import { createActivityLog } from '../src/activityLogRepository.js';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-immutability-test-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

// ============================================================
// FR-003: Append-only Guarantee Tests
// ============================================================

test('FR-003: UPDATE on activity_log should be rejected', () => {
  const { dir, db } = createTempDb();

  // Create a log entry
  const entry = createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'api',
    payload: { issue_id: 1, title: 'Test Task' },
  });

  // Attempt to UPDATE the log entry
  assert.throws(
    () => {
      db.prepare('UPDATE activity_log SET event_type = ? WHERE id = ?').run(
        'task.updated',
        entry.id
      );
    },
    {
      message: /activity_log is append-only/i,
    },
    'UPDATE on activity_log should throw an error'
  );

  db.close();
  fs.removeSync(dir);
});

test('FR-003: DELETE on activity_log should be rejected', () => {
  const { dir, db } = createTempDb();

  // Create a log entry
  const entry = createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'api',
    payload: { issue_id: 1, title: 'Test Task' },
  });

  // Attempt to DELETE the log entry
  assert.throws(
    () => {
      db.prepare('DELETE FROM activity_log WHERE id = ?').run(entry.id);
    },
    {
      message: /activity_log is append-only/i,
    },
    'DELETE on activity_log should throw an error'
  );

  db.close();
  fs.removeSync(dir);
});

test('FR-003: INSERT on activity_log should succeed', () => {
  const { dir, db } = createTempDb();

  // INSERT should work normally
  const entry = createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'api',
    payload: { issue_id: 1, title: 'Test Task' },
  });

  assert.ok(entry.id > 0, 'INSERT should succeed and return an ID');

  // Verify the entry exists
  const row = db
    .prepare('SELECT * FROM activity_log WHERE id = ?')
    .get(entry.id);
  assert.ok(row, 'Entry should exist in the database');

  db.close();
  fs.removeSync(dir);
});

test('FR-003: Multiple INSERTs should succeed (append-only)', () => {
  const { dir, db } = createTempDb();

  // Multiple INSERTs should work
  const entry1 = createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'api',
    payload: { issue_id: 1, title: 'Task 1' },
  });

  const entry2 = createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'cli',
    payload: { issue_id: 2, title: 'Task 2' },
  });

  const entry3 = createActivityLog(db, {
    eventType: 'task.status_changed',
    sourceType: 'api',
    payload: { issue_id: 1, from_status: 'inbox', to_status: 'done' },
  });

  // Verify all entries exist
  const count = db
    .prepare('SELECT COUNT(*) as count FROM activity_log')
    .get() as { count: number };
  assert.equal(count.count, 3, 'All 3 entries should exist');

  // Verify IDs are sequential
  assert.ok(entry2.id > entry1.id);
  assert.ok(entry3.id > entry2.id);

  db.close();
  fs.removeSync(dir);
});
