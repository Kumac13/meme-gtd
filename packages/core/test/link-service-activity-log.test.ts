import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase, listActivityLog, createTask } from 'meme-gtd-db';
import { LinkService } from '../src/linkService.js';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-link-log-test-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

// ============================================================
// LinkService Activity Log Integration Tests
// ============================================================

test('LinkService.create() logs link.created event', () => {
  const { dir, db } = createTempDb();
  const linkService = new LinkService({ db });

  // Create two tasks and link them
  const task1 = createTask(db, { title: 'Task 1', bodyMd: '' });
  const task2 = createTask(db, { title: 'Task 2', bodyMd: '' });
  const link = linkService.create(task1.id, task2.id, 'relates');

  // Verify activity log entry
  const logs = listActivityLog(db, {});
  const linkLog = logs.find(l => l.eventType === 'link.created');
  assert.ok(linkLog, 'link.created event should exist');
  assert.equal(linkLog.sourceType, 'api');
  assert.equal(linkLog.payload.link_id, link.id);
  assert.equal(linkLog.payload.source_issue_id, task1.id);
  assert.equal(linkLog.payload.target_issue_id, task2.id);

  db.close();
  fs.removeSync(dir);
});

test('LinkService.remove() logs link.deleted event', () => {
  const { dir, db } = createTempDb();
  const linkService = new LinkService({ db });

  // Create two tasks and link them
  const task1 = createTask(db, { title: 'Task 1', bodyMd: '' });
  const task2 = createTask(db, { title: 'Task 2', bodyMd: '' });
  const link = linkService.create(task1.id, task2.id, 'parent');

  // Remove the link
  linkService.remove(link.id);

  // Verify activity log entries (order: asc to get chronological order)
  const logs = listActivityLog(db, { order: 'asc' });
  const deleteLog = logs.find(l => l.eventType === 'link.deleted');
  assert.ok(deleteLog, 'link.deleted event should exist');
  assert.equal(deleteLog.payload.link_id, link.id);

  db.close();
  fs.removeSync(dir);
});

test('LinkService uses cli sourceType when specified', () => {
  const { dir, db } = createTempDb();
  const linkService = new LinkService({ db, sourceType: 'cli' });

  // Create two tasks and link them
  const task1 = createTask(db, { title: 'Task 1', bodyMd: '' });
  const task2 = createTask(db, { title: 'Task 2', bodyMd: '' });
  linkService.create(task1.id, task2.id, 'child');

  const logs = listActivityLog(db, {});
  const linkLog = logs.find(l => l.eventType === 'link.created');
  assert.ok(linkLog);
  assert.equal(linkLog.sourceType, 'cli');

  db.close();
  fs.removeSync(dir);
});
