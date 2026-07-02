import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import {
  applyMigrations,
  openDatabase,
  listActivityLog,
  createMemo,
  createTask,
} from 'meme-gtd-db';
import { LinkService } from '../src/linkService.js';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-memo-promoted-test-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

// ============================================================
// memo.promoted Activity Log Regression Tests (Issue #245)
//
// Both the CLI and Web promote flows converge on
// `LinkService.create(task.id, memoId, 'derived_from')`.
// A promote MUST record exactly one `memo.promoted` event.
// ============================================================

test('creating a task->memo derived_from link logs one memo.promoted event', () => {
  const { dir, db } = createTempDb();
  const linkService = new LinkService({ db });

  const memo = createMemo(db, { bodyMd: 'promote me' });
  const task = createTask(db, { title: 'Promoted Task', bodyMd: 'body', status: 'next' });

  const link = linkService.create(task.id, memo.id, 'derived_from');

  const promotedLogs = listActivityLog(db, {}).filter(l => l.eventType === 'memo.promoted');
  assert.equal(promotedLogs.length, 1, 'exactly one memo.promoted event should be recorded');

  const payload = promotedLogs[0].payload;
  assert.equal(payload.issue_id, task.id);
  assert.equal(payload.source_memo_id, memo.id);
  assert.equal(payload.source_memo_body, 'promote me');
  assert.equal(payload.promoted_task.id, task.id);
  assert.equal(payload.promoted_task.title, 'Promoted Task');
  assert.equal(payload.promoted_task.status, 'next');
  assert.equal(payload.link_id, link.id);

  db.close();
  fs.removeSync(dir);
});

test('memo.promoted uses the sourceType of the caller', () => {
  const { dir, db } = createTempDb();
  const linkService = new LinkService({ db, sourceType: 'cli' });

  const memo = createMemo(db, { bodyMd: 'from cli' });
  const task = createTask(db, { title: 'CLI Task', bodyMd: '' });

  linkService.create(task.id, memo.id, 'derived_from');

  const promotedLog = listActivityLog(db, {}).find(l => l.eventType === 'memo.promoted');
  assert.ok(promotedLog, 'memo.promoted event should exist');
  assert.equal(promotedLog.sourceType, 'cli');

  db.close();
  fs.removeSync(dir);
});

test('a derived_from link that is not task->memo does not log memo.promoted', () => {
  const { dir, db } = createTempDb();
  const linkService = new LinkService({ db });

  // task -> task derived_from (not a memo promotion)
  const task1 = createTask(db, { title: 'Task 1', bodyMd: '' });
  const task2 = createTask(db, { title: 'Task 2', bodyMd: '' });
  linkService.create(task1.id, task2.id, 'derived_from');

  const promotedLogs = listActivityLog(db, {}).filter(l => l.eventType === 'memo.promoted');
  assert.equal(promotedLogs.length, 0, 'non-promote derived_from must not log memo.promoted');

  db.close();
  fs.removeSync(dir);
});

test('non derived_from links between task and memo do not log memo.promoted', () => {
  const { dir, db } = createTempDb();
  const linkService = new LinkService({ db });

  const memo = createMemo(db, { bodyMd: 'related memo' });
  const task = createTask(db, { title: 'Task', bodyMd: '' });
  linkService.create(task.id, memo.id, 'relates');

  const promotedLogs = listActivityLog(db, {}).filter(l => l.eventType === 'memo.promoted');
  assert.equal(promotedLogs.length, 0, 'relates link must not log memo.promoted');

  db.close();
  fs.removeSync(dir);
});
