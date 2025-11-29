import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase } from '../src/index';
import {
  createTask,
  getTask,
  listTasks,
  updateTask,
  deleteTask,
  setTaskStatus,
  addComment as addTaskComment,
  deleteComment as deleteTaskComment,
  listComments as listTaskComments,
  listTaskLabels,
  setTaskLabels,
  setBookmark as setTaskBookmark
} from '../src/taskRepository';
import { createMemo } from '../src/memoRepository';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-dbtest-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

// T004: Test createTask() - Verify task creation with type='task'
test('createTask() creates task with type=task and default status=open', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Test Task', bodyMd: 'Task body content' });

  assert.ok(task.id > 0);
  assert.equal(task.type, 'task');
  assert.equal(task.title, 'Test Task');
  assert.equal(task.bodyMd, 'Task body content');
  assert.equal(task.status, 'open');
  assert.equal(task.scheduledOn, null);
  assert.equal(task.isBookmarked, false);
  assert.equal(task.isDeleted, false);

  db.close();
  fs.removeSync(dir);
});

test('createTask() with status and scheduledOn', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, {
    title: 'Scheduled Task',
    bodyMd: 'Body',
    status: 'scheduled',
    scheduledOn: '2025-10-20'
  });

  assert.equal(task.status, 'scheduled');
  assert.equal(task.scheduledOn, '2025-10-20');

  db.close();
  fs.removeSync(dir);
});

test('createTask() with labels', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, {
    title: 'Labeled Task',
    bodyMd: 'Body',
    labels: ['urgent', 'backend']
  });

  const labels = listTaskLabels(db, task.id);
  assert.deepEqual(labels, ['backend', 'urgent']); // Sorted alphabetically

  db.close();
  fs.removeSync(dir);
});

// T005: Test getTask() - Verify type validation (reject memo IDs)
test('getTask() retrieves task by ID', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Get Test', bodyMd: 'Body' });

  const retrieved = getTask(db, task.id);
  assert.equal(retrieved.id, task.id);
  assert.equal(retrieved.title, 'Get Test');
  assert.equal(retrieved.type, 'task');

  db.close();
  fs.removeSync(dir);
});

test('getTask() throws error for memo ID (type mismatch)', () => {
  const { dir, db } = createTempDb();
  const memo = createMemo(db, { bodyMd: 'This is a memo' });

  assert.throws(() => {
    getTask(db, memo.id);
  }, /ID refers to different type|not a task/);

  db.close();
  fs.removeSync(dir);
});

test('getTask() throws error for non-existent ID', () => {
  const { dir, db } = createTempDb();

  assert.throws(() => {
    getTask(db, 999);
  }, /Task not found/);

  db.close();
  fs.removeSync(dir);
});

// T006: Test listTasks() - Verify filtering by status/label
test('listTasks() lists all tasks', () => {
  const { dir, db } = createTempDb();
  createTask(db, { title: 'Task 1', bodyMd: 'Body 1' });
  createTask(db, { title: 'Task 2', bodyMd: 'Body 2' });

  const tasks = listTasks(db);
  assert.equal(tasks.length, 2);

  db.close();
  fs.removeSync(dir);
});

test('listTasks() filters by status', () => {
  const { dir, db } = createTempDb();
  createTask(db, { title: 'Open Task', bodyMd: 'Body', status: 'open' });
  createTask(db, { title: 'Next Task', bodyMd: 'Body', status: 'next' });
  createTask(db, { title: 'Done Task', bodyMd: 'Body', status: 'done' });

  const nextTasks = listTasks(db, { status: 'next' });
  assert.equal(nextTasks.length, 1);
  assert.equal(nextTasks[0].title, 'Next Task');

  db.close();
  fs.removeSync(dir);
});

test('listTasks() filters by label', () => {
  const { dir, db } = createTempDb();
  createTask(db, { title: 'Urgent Task', bodyMd: 'Body', labels: ['urgent'] });
  createTask(db, { title: 'Normal Task', bodyMd: 'Body', labels: ['normal'] });

  const urgentTasks = listTasks(db, { label: 'urgent' });
  assert.equal(urgentTasks.length, 1);
  assert.equal(urgentTasks[0].title, 'Urgent Task');

  db.close();
  fs.removeSync(dir);
});

test('listTasks() filters by bookmarked', () => {
  const { dir, db } = createTempDb();
  const task1 = createTask(db, { title: 'Task 1', bodyMd: 'Body' });
  const task2 = createTask(db, { title: 'Task 2', bodyMd: 'Body' });
  setTaskBookmark(db, task1.id, true);

  const bookmarked = listTasks(db, { isBookmarked: true });
  assert.equal(bookmarked.length, 1);
  assert.equal(bookmarked[0].id, task1.id);

  db.close();
  fs.removeSync(dir);
});

test('listTasks() respects limit', () => {
  const { dir, db } = createTempDb();
  createTask(db, { title: 'Task 1', bodyMd: 'Body' });
  createTask(db, { title: 'Task 2', bodyMd: 'Body' });
  createTask(db, { title: 'Task 3', bodyMd: 'Body' });

  const tasks = listTasks(db, { limit: 2 });
  assert.equal(tasks.length, 2);

  db.close();
  fs.removeSync(dir);
});

// T007: Test updateTask() - Verify field updates
test('updateTask() updates title and body', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Original', bodyMd: 'Original body' });

  const updated = updateTask(db, {
    id: task.id,
    title: 'Updated Title',
    bodyMd: 'Updated body'
  });

  assert.equal(updated.title, 'Updated Title');
  assert.equal(updated.bodyMd, 'Updated body');

  db.close();
  fs.removeSync(dir);
});

test('updateTask() updates status and scheduledOn', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body' });

  const updated = updateTask(db, {
    id: task.id,
    status: 'scheduled',
    scheduledOn: '2025-11-01'
  });

  assert.equal(updated.status, 'scheduled');
  assert.equal(updated.scheduledOn, '2025-11-01');

  db.close();
  fs.removeSync(dir);
});

test('updateTask() adds and removes labels', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', labels: ['old'] });

  updateTask(db, {
    id: task.id,
    addLabels: ['new1', 'new2'],
    removeLabels: ['old']
  });

  const labels = listTaskLabels(db, task.id);
  assert.deepEqual(labels, ['new1', 'new2']);

  db.close();
  fs.removeSync(dir);
});

// T008: Test deleteTask() - Verify logical deletion
test('deleteTask() performs logical deletion', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'To Delete', bodyMd: 'Body' });

  deleteTask(db, task.id);

  // Task should not appear in list
  const tasks = listTasks(db);
  assert.equal(tasks.length, 0);

  // But should still exist in DB with is_deleted=1
  const row = db.prepare('SELECT is_deleted FROM issues WHERE id = ?').get(task.id) as any;
  assert.equal(row.is_deleted, 1);

  db.close();
  fs.removeSync(dir);
});

test('deleteTask() throws error for non-existent task', () => {
  const { dir, db } = createTempDb();

  assert.throws(() => {
    deleteTask(db, 999);
  }, /Task not found/);

  db.close();
  fs.removeSync(dir);
});

// T009: Test setTaskStatus() - Verify status transitions
test('setTaskStatus() changes status', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open' });

  const updated = setTaskStatus(db, task.id, 'done');
  assert.equal(updated.status, 'done');

  db.close();
  fs.removeSync(dir);
});

test('setTaskStatus() supports all status transitions', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body' });

  setTaskStatus(db, task.id, 'next');
  assert.equal(getTask(db, task.id).status, 'next');

  setTaskStatus(db, task.id, 'waiting');
  assert.equal(getTask(db, task.id).status, 'waiting');

  setTaskStatus(db, task.id, 'scheduled');
  assert.equal(getTask(db, task.id).status, 'scheduled');

  setTaskStatus(db, task.id, 'done');
  assert.equal(getTask(db, task.id).status, 'done');

  setTaskStatus(db, task.id, 'open'); // Reopen
  assert.equal(getTask(db, task.id).status, 'open');

  setTaskStatus(db, task.id, 'canceled');
  assert.equal(getTask(db, task.id).status, 'canceled');

  db.close();
  fs.removeSync(dir);
});

// Additional tests for comment and label functions
test('addTaskComment() and listTaskComments()', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body' });

  addTaskComment(db, task.id, 'First comment');
  addTaskComment(db, task.id, 'Second comment');

  const comments = listTaskComments(db, task.id);
  assert.equal(comments.length, 2);
  assert.equal(comments[0].bodyMd, 'First comment');
  assert.equal(comments[1].bodyMd, 'Second comment');

  db.close();
  fs.removeSync(dir);
});

test('setTaskLabels() replaces all labels', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', labels: ['old1', 'old2'] });

  setTaskLabels(db, task.id, ['new1', 'new2', 'new3']);

  const labels = listTaskLabels(db, task.id);
  assert.deepEqual(labels, ['new1', 'new2', 'new3']);

  db.close();
  fs.removeSync(dir);
});

test('setTaskBookmark() sets and clears bookmark (idempotent)', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body' });

  // Set bookmark
  setTaskBookmark(db, task.id, true);
  assert.equal(getTask(db, task.id).isBookmarked, true);

  // Set again (idempotent)
  setTaskBookmark(db, task.id, true);
  assert.equal(getTask(db, task.id).isBookmarked, true);

  // Clear bookmark
  setTaskBookmark(db, task.id, false);
  assert.equal(getTask(db, task.id).isBookmarked, false);

  // Clear again (idempotent)
  setTaskBookmark(db, task.id, false);
  assert.equal(getTask(db, task.id).isBookmarked, false);

  db.close();
  fs.removeSync(dir);
});

test('setTaskBookmark() rejects memo ID', () => {
  const { dir, db } = createTempDb();
  const memo = createMemo(db, { bodyMd: 'This is a memo' });

  assert.throws(() => {
    setTaskBookmark(db, memo.id, true);
  }, /not a task/);

  db.close();
  fs.removeSync(dir);
});

test('listTasks returns commentCount field', () => {
  const { dir, db } = createTempDb();

  // Test task with 0 comments
  const task1 = createTask(db, { title: 'Task 1', bodyMd: 'task without comments' });
  let tasks = listTasks(db, {});
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].commentCount, 0);

  // Test task with N comments
  const task2 = createTask(db, { title: 'Task 2', bodyMd: 'task with comments' });
  addTaskComment(db, task2.id, 'comment 1');
  addTaskComment(db, task2.id, 'comment 2');
  addTaskComment(db, task2.id, 'comment 3');
  tasks = listTasks(db, {});
  const foundTask2 = tasks.find(t => t.id === task2.id);
  assert.ok(foundTask2);
  assert.equal(foundTask2.commentCount, 3);

  // Test task with soft-deleted comments excludes them from count
  const task3 = createTask(db, { title: 'Task 3', bodyMd: 'task with deleted comments' });
  addTaskComment(db, task3.id, 'active comment 1');
  addTaskComment(db, task3.id, 'active comment 2');
  const deletedComment = addTaskComment(db, task3.id, 'to be deleted');
  deleteTaskComment(db, deletedComment.id);
  tasks = listTasks(db, {});
  const foundTask3 = tasks.find(t => t.id === task3.id);
  assert.ok(foundTask3);
  assert.equal(foundTask3.commentCount, 2); // Only count active comments

  // Test filtered results include accurate comment counts
  const task4 = createTask(db, { title: 'Task 4', bodyMd: 'next status task', status: 'next' });
  addTaskComment(db, task4.id, 'comment on next task');
  const nextTasks = listTasks(db, { status: 'next' });
  assert.equal(nextTasks.length, 1);
  assert.equal(nextTasks[0].commentCount, 1);

  db.close();
  fs.removeSync(dir);
});

// Test listTasks() with search filter
test('listTasks() with search filter returns matching tasks', () => {
  const { dir, db } = createTempDb();

  // Create test tasks
  createTask(db, { title: 'Implement login feature', bodyMd: 'OAuth integration' });
  createTask(db, { title: 'Fix authentication bug', bodyMd: 'Session handling' });
  createTask(db, { title: 'Add user settings', bodyMd: 'Profile page' });

  // Search by title
  const results = listTasks(db, { search: 'login' });

  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Implement login feature');
  assert.ok(results[0].preview); // Preview should be present
  assert.ok(results[0].preview.includes('<mark>login</mark>')); // Highlighted

  db.close();
  fs.removeSync(dir);
});

test('listTasks() with multi-word search', () => {
  const { dir, db } = createTempDb();

  createTask(db, { title: 'Implement OAuth login screen', bodyMd: 'Frontend UI' });
  createTask(db, { title: 'Update screen layout for login', bodyMd: 'CSS changes' });
  createTask(db, { title: 'Add screen transitions', bodyMd: 'Animation' });

  // Multi-word implicit AND
  const results = listTasks(db, { search: 'login screen' });

  assert.equal(results.length, 2); // Both tasks have "login" AND "screen"
  assert.ok(results.every(t => t.preview)); // All results should have preview

  db.close();
  fs.removeSync(dir);
});

test('listTasks() search combined with status filter', () => {
  const { dir, db } = createTempDb();

  createTask(db, { title: 'Fix login bug', bodyMd: 'Open bug', status: 'open' });
  createTask(db, { title: 'Fix login issue', bodyMd: 'Done task', status: 'done' });
  createTask(db, { title: 'Add feature', bodyMd: 'Open task', status: 'open' });

  // Search for "login" with status "open"
  const results = listTasks(db, { search: 'login', status: 'open' });

  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Fix login bug');
  assert.equal(results[0].status, 'open');

  db.close();
  fs.removeSync(dir);
});

test('listTasks() search combined with label filter', () => {
  const { dir, db } = createTempDb();

  createTask(db, { title: 'Fix login authentication', bodyMd: 'Bug fix', labels: ['bug'] });
  createTask(db, { title: 'Add login feature', bodyMd: 'Enhancement', labels: ['feature'] });
  createTask(db, { title: 'Update login UI', bodyMd: 'Bug fix', labels: ['bug'] });

  // Search for "login" with label "bug"
  const results = listTasks(db, { search: 'login', label: 'bug' });

  assert.equal(results.length, 2);
  assert.ok(results.every(t => t.title.includes('login')));

  db.close();
  fs.removeSync(dir);
});

test('listTasks() search returns empty when no match', () => {
  const { dir, db } = createTempDb();

  createTask(db, { title: 'Task one', bodyMd: 'Content' });
  createTask(db, { title: 'Task two', bodyMd: 'Content' });

  const results = listTasks(db, { search: 'nonexistent' });

  assert.equal(results.length, 0);

  db.close();
  fs.removeSync(dir);
});

test('listTasks() without search does not include preview field', () => {
  const { dir, db } = createTempDb();

  createTask(db, { title: 'Test task', bodyMd: 'Content' });

  const results = listTasks(db, {});

  assert.equal(results.length, 1);
  assert.equal(results[0].preview, undefined); // No preview when not searching

  db.close();
  fs.removeSync(dir);
});

// Tests for auto-setting date/time fields on status change
test('setTaskStatus() to done sets end_date to current date', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open' });

  const updated = setTaskStatus(db, task.id, 'done');

  const today = new Date().toISOString().split('T')[0];
  assert.equal(updated.status, 'done');
  assert.equal(updated.endDate, today);

  db.close();
  fs.removeSync(dir);
});

test('setTaskStatus() to done sets end_time when scheduled_on is today', () => {
  const { dir, db } = createTempDb();
  const today = new Date().toISOString().split('T')[0];
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open', scheduledOn: today });

  const updated = setTaskStatus(db, task.id, 'done');

  assert.equal(updated.status, 'done');
  assert.equal(updated.endDate, today);
  assert.ok(updated.endTime); // end_time should be set
  assert.match(updated.endTime, /^\d{2}:\d{2}$/); // HH:MM format

  db.close();
  fs.removeSync(dir);
});

test('setTaskStatus() to done does not set end_time when scheduled_on is different day', () => {
  const { dir, db } = createTempDb();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open', scheduledOn: yesterday });

  const updated = setTaskStatus(db, task.id, 'done');

  const today = new Date().toISOString().split('T')[0];
  assert.equal(updated.status, 'done');
  assert.equal(updated.endDate, today);
  assert.equal(updated.endTime, null); // end_time should NOT be set

  db.close();
  fs.removeSync(dir);
});

test('setTaskStatus() to next sets scheduled_on and start_time', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open' });

  const updated = setTaskStatus(db, task.id, 'next');

  const today = new Date().toISOString().split('T')[0];
  assert.equal(updated.status, 'next');
  assert.equal(updated.scheduledOn, today);
  assert.ok(updated.startTime);
  assert.match(updated.startTime, /^\d{2}:\d{2}$/); // HH:MM format

  db.close();
  fs.removeSync(dir);
});

test('setTaskStatus() to next clears end_date and end_time', () => {
  const { dir, db } = createTempDb();
  // Create task with end_date and end_time set
  const task = createTask(db, {
    title: 'Task',
    bodyMd: 'Body',
    status: 'done',
    endDate: '2025-11-01',
    endTime: '14:00'
  });

  const updated = setTaskStatus(db, task.id, 'next');

  assert.equal(updated.status, 'next');
  assert.equal(updated.endDate, null);
  assert.equal(updated.endTime, null);

  db.close();
  fs.removeSync(dir);
});

test('setTaskStatus() to next overwrites existing scheduled_on', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'scheduled', scheduledOn: '2025-12-01' });

  const updated = setTaskStatus(db, task.id, 'next');

  const today = new Date().toISOString().split('T')[0];
  assert.equal(updated.status, 'next');
  assert.equal(updated.scheduledOn, today); // Should be overwritten to today

  db.close();
  fs.removeSync(dir);
});

test('updateTask() with status=done auto-sets end_date', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open' });

  const updated = updateTask(db, { id: task.id, status: 'done' });

  const today = new Date().toISOString().split('T')[0];
  assert.equal(updated.status, 'done');
  assert.equal(updated.endDate, today);

  db.close();
  fs.removeSync(dir);
});

test('updateTask() with status=next auto-sets scheduled_on and start_time', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open' });

  const updated = updateTask(db, { id: task.id, status: 'next' });

  const today = new Date().toISOString().split('T')[0];
  assert.equal(updated.status, 'next');
  assert.equal(updated.scheduledOn, today);
  assert.ok(updated.startTime);

  db.close();
  fs.removeSync(dir);
});

test('updateTask() with explicit endDate does not auto-set', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open' });

  const updated = updateTask(db, {
    id: task.id,
    status: 'done',
    endDate: '2025-12-31' // Explicit value
  });

  assert.equal(updated.status, 'done');
  assert.equal(updated.endDate, '2025-12-31'); // Should keep explicit value

  db.close();
  fs.removeSync(dir);
});

test('updateTask() with explicit scheduledOn does not auto-set on next', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open' });

  const updated = updateTask(db, {
    id: task.id,
    status: 'next',
    scheduledOn: '2025-12-31' // Explicit value
  });

  assert.equal(updated.status, 'next');
  assert.equal(updated.scheduledOn, '2025-12-31'); // Should keep explicit value

  db.close();
  fs.removeSync(dir);
});

test('updateTask() does not auto-set when status is not changing', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'done' });

  // Update title without changing status
  const updated = updateTask(db, {
    id: task.id,
    status: 'done', // Same status
    title: 'Updated Title'
  });

  assert.equal(updated.title, 'Updated Title');
  // end_date should not be auto-set since status didn't actually change
  assert.equal(updated.endDate, null);

  db.close();
  fs.removeSync(dir);
});
