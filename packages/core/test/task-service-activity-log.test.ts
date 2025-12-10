import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase, listActivityLog } from 'meme-gtd-db';
import { TaskService } from '../src/index.js';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-task-service-test-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

// ============================================================
// TaskService Integration Test: Activity Log Recording
// ============================================================

test('TaskService.create() records task.created event in activity_log', () => {
  const { dir, db } = createTempDb();

  const taskService = new TaskService({ db, sourceType: 'api' });

  // Before: activity_log should be empty
  const logsBefore = listActivityLog(db, {});
  assert.equal(logsBefore.length, 0, 'activity_log should be empty before create');

  // Action: create a task
  const task = taskService.create({
    title: 'Test Task',
    bodyMd: 'Test body',
  });

  // After: activity_log should have 1 entry
  const logsAfter = listActivityLog(db, {});
  assert.equal(logsAfter.length, 1, 'activity_log should have 1 entry after create');

  // Verify the log entry
  const logEntry = logsAfter[0];
  assert.equal(logEntry.eventType, 'task.created');
  assert.equal(logEntry.sourceType, 'api');
  assert.equal(logEntry.issueId, task.id);
  assert.equal(logEntry.payload.title, 'Test Task');
  assert.equal(logEntry.payload.status, 'inbox');

  db.close();
  fs.removeSync(dir);
});

test('TaskService.edit() with status change records task.status_changed event', () => {
  const { dir, db } = createTempDb();

  const taskService = new TaskService({ db, sourceType: 'api' });

  // Create a task first
  const task = taskService.create({
    title: 'Test Task',
    bodyMd: 'Test body',
  });

  // Clear logs count after create
  const logsAfterCreate = listActivityLog(db, {});
  assert.equal(logsAfterCreate.length, 1);

  // Action: edit task with status change
  taskService.edit({
    id: task.id,
    status: 'open',
  });

  // After: activity_log should have 2 entries
  const logsAfterEdit = listActivityLog(db, {});
  assert.equal(logsAfterEdit.length, 2, 'activity_log should have 2 entries after edit');

  // Verify the status change log entry (most recent)
  const statusChangeLog = logsAfterEdit.find(l => l.eventType === 'task.status_changed');
  assert.ok(statusChangeLog, 'should have task.status_changed event');
  assert.equal(statusChangeLog.payload.from_status, 'inbox');
  assert.equal(statusChangeLog.payload.to_status, 'open');
  assert.equal(statusChangeLog.issueId, task.id);

  db.close();
  fs.removeSync(dir);
});

test('TaskService.edit() without status change records task.updated event', () => {
  const { dir, db } = createTempDb();

  const taskService = new TaskService({ db, sourceType: 'api' });

  // Create a task first
  const task = taskService.create({
    title: 'Original Title',
    bodyMd: 'Test body',
  });

  // Action: edit task title only (no status change)
  taskService.edit({
    id: task.id,
    title: 'Updated Title',
  });

  // After: activity_log should have 2 entries
  const logs = listActivityLog(db, {});
  assert.equal(logs.length, 2);

  // Verify the update log entry
  const updateLog = logs.find(l => l.eventType === 'task.updated');
  assert.ok(updateLog, 'should have task.updated event');
  assert.equal(updateLog.issueId, task.id);

  db.close();
  fs.removeSync(dir);
});

test('TaskService.close() records task.status_changed event with to_status=done', () => {
  const { dir, db } = createTempDb();

  const taskService = new TaskService({ db, sourceType: 'api' });

  // Create a task
  const task = taskService.create({
    title: 'Test Task',
    bodyMd: 'Test body',
  });

  // Action: close the task
  taskService.close(task.id);

  // Verify status change log
  const logs = listActivityLog(db, { eventType: 'task.status_changed' });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].payload.from_status, 'inbox');
  assert.equal(logs[0].payload.to_status, 'done');

  db.close();
  fs.removeSync(dir);
});

test('TaskService.cancel() records task.status_changed event with to_status=canceled', () => {
  const { dir, db } = createTempDb();

  const taskService = new TaskService({ db, sourceType: 'api' });

  // Create a task
  const task = taskService.create({
    title: 'Test Task',
    bodyMd: 'Test body',
  });

  // Action: cancel the task
  taskService.cancel(task.id);

  // Verify status change log
  const logs = listActivityLog(db, { eventType: 'task.status_changed' });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].payload.to_status, 'canceled');

  db.close();
  fs.removeSync(dir);
});

test('TaskService.reopen() records task.status_changed event with to_status=open', () => {
  const { dir, db } = createTempDb();

  const taskService = new TaskService({ db, sourceType: 'api' });

  // Create and close a task
  const task = taskService.create({
    title: 'Test Task',
    bodyMd: 'Test body',
  });
  taskService.close(task.id);

  // Action: reopen the task
  taskService.reopen(task.id);

  // Verify: should have 2 status_changed events (close + reopen)
  const logs = listActivityLog(db, { eventType: 'task.status_changed' });
  assert.equal(logs.length, 2);

  // Most recent should be reopen
  const reopenLog = logs.find(l => l.payload.to_status === 'open');
  assert.ok(reopenLog);
  assert.equal(reopenLog.payload.from_status, 'done');

  db.close();
  fs.removeSync(dir);
});

test('TaskService.remove() records task.deleted event', () => {
  const { dir, db } = createTempDb();

  const taskService = new TaskService({ db, sourceType: 'api' });

  // Create a task
  const task = taskService.create({
    title: 'Test Task',
    bodyMd: 'Test body',
  });

  // Action: delete the task
  taskService.remove(task.id);

  // Verify delete log
  const logs = listActivityLog(db, { eventType: 'task.deleted' });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].issueId, task.id);

  db.close();
  fs.removeSync(dir);
});

test('TaskService.setBookmark() records task.bookmarked event', () => {
  const { dir, db } = createTempDb();

  const taskService = new TaskService({ db, sourceType: 'api' });

  // Create a task
  const task = taskService.create({
    title: 'Test Task',
    bodyMd: 'Test body',
  });

  // Action: bookmark the task
  taskService.setBookmark(task.id, true);

  // Verify bookmark log
  const logs = listActivityLog(db, { eventType: 'task.bookmarked' });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].issueId, task.id);
  assert.equal(logs[0].payload.is_bookmarked, true);

  db.close();
  fs.removeSync(dir);
});

test('TaskService with sourceType=cli records cli as source', () => {
  const { dir, db } = createTempDb();

  const taskService = new TaskService({ db, sourceType: 'cli' });

  // Create a task
  taskService.create({
    title: 'CLI Task',
    bodyMd: 'Created from CLI',
  });

  // Verify source type
  const logs = listActivityLog(db, {});
  assert.equal(logs[0].sourceType, 'cli');

  db.close();
  fs.removeSync(dir);
});
