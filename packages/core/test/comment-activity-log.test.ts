import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase, listActivityLog } from 'meme-gtd-db';
import { MemoService, TaskService } from '../src/index.js';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-comment-log-test-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

// ============================================================
// Comment Activity Log Tests (via MemoService)
// ============================================================

test('MemoService.addComment() logs comment.created event', () => {
  const { dir, db } = createTempDb();
  const memoService = new MemoService({ db });

  // Create a memo and add comment
  const memo = memoService.create({ bodyMd: 'Test memo' });
  const comment = memoService.addComment(memo.id, 'Test comment');

  // Verify activity log entries
  const logs = listActivityLog(db, { order: 'asc' });
  const commentLog = logs.find(l => l.eventType === 'comment.created');
  assert.ok(commentLog, 'comment.created event should exist');
  assert.equal(commentLog.payload.comment_id, comment.id);
  assert.equal(commentLog.payload.issue_id, memo.id);

  db.close();
  fs.removeSync(dir);
});

test('MemoService.updateComment() logs comment.updated event', () => {
  const { dir, db } = createTempDb();
  const memoService = new MemoService({ db });

  // Create memo, add comment, then update
  const memo = memoService.create({ bodyMd: 'Test memo' });
  const comment = memoService.addComment(memo.id, 'Original comment');
  memoService.updateComment(comment.id, 'Updated comment');

  // Verify activity log entries
  const logs = listActivityLog(db, { order: 'asc' });
  const updateLog = logs.find(l => l.eventType === 'comment.updated');
  assert.ok(updateLog, 'comment.updated event should exist');
  assert.equal(updateLog.payload.comment_id, comment.id);

  db.close();
  fs.removeSync(dir);
});

test('MemoService.deleteComment() logs comment.deleted event', () => {
  const { dir, db } = createTempDb();
  const memoService = new MemoService({ db });

  // Create memo, add comment, then delete
  const memo = memoService.create({ bodyMd: 'Test memo' });
  const comment = memoService.addComment(memo.id, 'Comment to delete');
  memoService.deleteComment(comment.id);

  // Verify activity log entries
  const logs = listActivityLog(db, { order: 'asc' });
  const deleteLog = logs.find(l => l.eventType === 'comment.deleted');
  assert.ok(deleteLog, 'comment.deleted event should exist');
  assert.equal(deleteLog.payload.comment_id, comment.id);

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// Comment Activity Log Tests (via TaskService)
// ============================================================

test('TaskService.addComment() logs comment.created event', () => {
  const { dir, db } = createTempDb();
  const taskService = new TaskService({ db });

  // Create a task and add comment
  const task = taskService.create({ title: 'Test Task', bodyMd: '' });
  const comment = taskService.addComment(task.id, 'Test comment');

  // Verify activity log entries
  const logs = listActivityLog(db, { order: 'asc' });
  const commentLog = logs.find(l => l.eventType === 'comment.created');
  assert.ok(commentLog, 'comment.created event should exist');
  assert.equal(commentLog.payload.comment_id, comment.id);
  assert.equal(commentLog.payload.issue_id, task.id);

  db.close();
  fs.removeSync(dir);
});

test('TaskService.updateComment() logs comment.updated event', () => {
  const { dir, db } = createTempDb();
  const taskService = new TaskService({ db });

  // Create task, add comment, then update
  const task = taskService.create({ title: 'Test Task', bodyMd: '' });
  const comment = taskService.addComment(task.id, 'Original comment');
  taskService.updateComment(comment.id, 'Updated comment');

  // Verify activity log entries
  const logs = listActivityLog(db, { order: 'asc' });
  const updateLog = logs.find(l => l.eventType === 'comment.updated');
  assert.ok(updateLog, 'comment.updated event should exist');
  assert.equal(updateLog.payload.comment_id, comment.id);

  db.close();
  fs.removeSync(dir);
});

test('TaskService.deleteComment() logs comment.deleted event', () => {
  const { dir, db } = createTempDb();
  const taskService = new TaskService({ db });

  // Create task, add comment, then delete
  const task = taskService.create({ title: 'Test Task', bodyMd: '' });
  const comment = taskService.addComment(task.id, 'Comment to delete');
  taskService.deleteComment(comment.id);

  // Verify activity log entries
  const logs = listActivityLog(db, { order: 'asc' });
  const deleteLog = logs.find(l => l.eventType === 'comment.deleted');
  assert.ok(deleteLog, 'comment.deleted event should exist');
  assert.equal(deleteLog.payload.comment_id, comment.id);

  db.close();
  fs.removeSync(dir);
});
