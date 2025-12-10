import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase, listActivityLog } from 'meme-gtd-db';
import { MemoService } from '../src/index.js';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-memo-log-test-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

// ============================================================
// MemoService Activity Log Integration Tests
// ============================================================

test('MemoService.create() logs memo.created event', () => {
  const { dir, db } = createTempDb();
  const memoService = new MemoService({ db });

  // Create a memo
  const memo = memoService.create({ bodyMd: 'Test memo content' });

  // Verify activity log entry
  const logs = listActivityLog(db, {});
  assert.equal(logs.length, 1);
  assert.equal(logs[0].eventType, 'memo.created');
  assert.equal(logs[0].sourceType, 'api');

  const payload = logs[0].payload;
  assert.equal(payload.issue_id, memo.id);
  assert.equal(payload.issue_type, 'memo');
  assert.equal(payload.body, 'Test memo content');

  db.close();
  fs.removeSync(dir);
});

test('MemoService.edit() logs memo.updated event', () => {
  const { dir, db } = createTempDb();
  const memoService = new MemoService({ db });

  // Create then edit a memo
  const memo = memoService.create({ bodyMd: 'Original content' });
  memoService.edit({ id: memo.id, bodyMd: 'Updated content' });

  // Verify activity log entries (order: asc to get chronological order)
  const logs = listActivityLog(db, { order: 'asc' });
  assert.equal(logs.length, 2);
  assert.equal(logs[0].eventType, 'memo.created');
  assert.equal(logs[1].eventType, 'memo.updated');
  assert.equal(logs[1].payload.issue_id, memo.id);

  db.close();
  fs.removeSync(dir);
});

test('MemoService.remove() logs memo.deleted event', () => {
  const { dir, db } = createTempDb();
  const memoService = new MemoService({ db });

  // Create then delete a memo
  const memo = memoService.create({ bodyMd: 'To be deleted' });
  memoService.remove(memo.id);

  // Verify activity log entries (order: asc to get chronological order)
  const logs = listActivityLog(db, { order: 'asc' });
  assert.equal(logs.length, 2);
  assert.equal(logs[0].eventType, 'memo.created');
  assert.equal(logs[1].eventType, 'memo.deleted');
  assert.equal(logs[1].payload.issue_id, memo.id);

  db.close();
  fs.removeSync(dir);
});

test('MemoService.promote() logs memo.promoted event', () => {
  const { dir, db } = createTempDb();
  const memoService = new MemoService({ db });

  // Create a memo and promote it to task
  const memo = memoService.create({ bodyMd: 'Memo to promote' });
  const result = memoService.promote({ memoId: memo.id, title: 'Promoted Task' });

  // Verify activity log entries
  const logs = listActivityLog(db, {});
  // Expected: memo.created, memo.promoted
  const promoteLog = logs.find(l => l.eventType === 'memo.promoted');
  assert.ok(promoteLog, 'memo.promoted event should exist');
  assert.equal(promoteLog.payload.source_memo_id, memo.id);
  assert.equal(promoteLog.payload.issue_id, result.taskId);

  db.close();
  fs.removeSync(dir);
});

test('MemoService.setBookmark() logs memo.bookmarked event', () => {
  const { dir, db } = createTempDb();
  const memoService = new MemoService({ db });

  // Create and bookmark a memo
  const memo = memoService.create({ bodyMd: 'Bookmarkable memo' });
  memoService.setBookmark(memo.id, true);

  // Verify activity log entries
  const logs = listActivityLog(db, {});
  const bookmarkLog = logs.find(l => l.eventType === 'memo.bookmarked');
  assert.ok(bookmarkLog, 'memo.bookmarked event should exist');
  assert.equal(bookmarkLog.payload.issue_id, memo.id);
  assert.equal(bookmarkLog.payload.is_bookmarked, true);

  db.close();
  fs.removeSync(dir);
});

test('MemoService uses cli sourceType when specified', () => {
  const { dir, db } = createTempDb();
  const memoService = new MemoService({ db, sourceType: 'cli' });

  memoService.create({ bodyMd: 'CLI memo' });

  const logs = listActivityLog(db, {});
  assert.equal(logs.length, 1);
  assert.equal(logs[0].sourceType, 'cli');

  db.close();
  fs.removeSync(dir);
});
