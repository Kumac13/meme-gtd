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

/**
 * Get local date in YYYY-MM-DD format
 * Uses local timezone to match taskRepository behavior
 */
const getLocalDate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// T004: Test createTask() - Verify task creation with type='task'
test('createTask() creates task with type=task and default status=inbox', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Test Task', bodyMd: 'Task body content' });

  assert.ok(task.id > 0);
  assert.equal(task.type, 'task');
  assert.equal(task.title, 'Test Task');
  assert.equal(task.bodyMd, 'Task body content');
  assert.equal(task.status, 'inbox');
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

// Test listTasks() with search filter (uses LIKE for substring matching)
test('listTasks() with search filter returns matching tasks', () => {
  const { dir, db } = createTempDb();

  // Create test tasks
  createTask(db, { title: 'Implement login feature', bodyMd: 'OAuth integration' });
  createTask(db, { title: 'Fix authentication bug', bodyMd: 'Session handling' });
  createTask(db, { title: 'Add user settings', bodyMd: 'Profile page' });

  // Search by title (LIKE search, no preview)
  const results = listTasks(db, { search: 'login' });

  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Implement login feature');
  assert.equal(results[0].preview, undefined); // LIKE search does not include preview

  db.close();
  fs.removeSync(dir);
});

test('listTasks() with substring search', () => {
  const { dir, db } = createTempDb();

  createTask(db, { title: 'TaskToMemo conversion', bodyMd: 'Feature' });
  createTask(db, { title: 'Add Memo feature', bodyMd: 'Another feature' });
  createTask(db, { title: 'Unrelated task', bodyMd: 'Nothing' });

  // Substring search matches partial words
  const results = listTasks(db, { search: 'Memo' });

  assert.equal(results.length, 2);
  assert.ok(results.some(t => t.title === 'TaskToMemo conversion'));
  assert.ok(results.some(t => t.title === 'Add Memo feature'));

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

// Tests for auto-setting actual_start/actual_end on status change
test('setTaskStatus() to done sets actual_end to current datetime', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'next' });

  const updated = setTaskStatus(db, task.id, 'done');

  const today = getLocalDate();
  assert.equal(updated.status, 'done');
  assert.ok(updated.actualEnd); // actual_end should be set
  assert.ok(updated.actualEnd.startsWith(today)); // Should start with today's date
  assert.match(updated.actualEnd, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/); // ISO 8601 format

  db.close();
  fs.removeSync(dir);
});

test('setTaskStatus() to next sets actual_start to current datetime', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open' });

  const updated = setTaskStatus(db, task.id, 'next');

  const today = getLocalDate();
  assert.equal(updated.status, 'next');
  assert.ok(updated.actualStart); // actual_start should be set
  assert.ok(updated.actualStart.startsWith(today)); // Should start with today's date
  assert.match(updated.actualStart, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/); // ISO 8601 format

  db.close();
  fs.removeSync(dir);
});

test('setTaskStatus() to next clears actual_end', () => {
  const { dir, db } = createTempDb();
  // Create task with actual_end set
  const task = createTask(db, {
    title: 'Task',
    bodyMd: 'Body',
    status: 'done',
    actualEnd: '2025-11-01T14:00:00'
  });

  const updated = setTaskStatus(db, task.id, 'next');

  assert.equal(updated.status, 'next');
  assert.ok(updated.actualStart); // Should be set
  assert.equal(updated.actualEnd, null); // Should be cleared

  db.close();
  fs.removeSync(dir);
});

test('setTaskStatus() does not modify deprecated fields', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open' });

  const updated = setTaskStatus(db, task.id, 'next');

  // Deprecated fields should NOT be set by setTaskStatus
  assert.equal(updated.scheduledOn, null);
  assert.equal(updated.startTime, null);

  db.close();
  fs.removeSync(dir);
});

test('updateTask() with status=done auto-sets actual_end', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'next' });

  const updated = updateTask(db, { id: task.id, status: 'done' });

  const today = getLocalDate();
  assert.equal(updated.status, 'done');
  assert.ok(updated.actualEnd); // actual_end should be set
  assert.ok(updated.actualEnd.startsWith(today)); // Should start with today's date

  db.close();
  fs.removeSync(dir);
});

test('updateTask() with status=next auto-sets actual_start', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open' });

  const updated = updateTask(db, { id: task.id, status: 'next' });

  const today = getLocalDate();
  assert.equal(updated.status, 'next');
  assert.ok(updated.actualStart); // actual_start should be set
  assert.ok(updated.actualStart.startsWith(today)); // Should start with today's date

  db.close();
  fs.removeSync(dir);
});

test('updateTask() with explicit actualEnd does not auto-set', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'next' });

  const updated = updateTask(db, {
    id: task.id,
    status: 'done',
    actualEnd: '2025-12-31T18:00:00' // Explicit value
  });

  assert.equal(updated.status, 'done');
  assert.equal(updated.actualEnd, '2025-12-31T18:00:00'); // Should keep explicit value

  db.close();
  fs.removeSync(dir);
});

test('updateTask() with explicit actualStart does not auto-set on next', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body', status: 'open' });

  const updated = updateTask(db, {
    id: task.id,
    status: 'next',
    actualStart: '2025-12-31T09:00:00' // Explicit value
  });

  assert.equal(updated.status, 'next');
  assert.equal(updated.actualStart, '2025-12-31T09:00:00'); // Should keep explicit value

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
  // actual_end should not be auto-set since status didn't actually change
  assert.equal(updated.actualEnd, null);

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// Phase 2: Calendar Datetime Separation Tests (T004-T006)
// New fields: scheduledStart, scheduledEnd, isAllDay, actualStart, actualEnd
// ============================================================

// T004: Test createTask with scheduledStart/scheduledEnd/isAllDay
test('createTask() with scheduledStart and scheduledEnd', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, {
    title: 'Scheduled Task',
    bodyMd: 'Body',
    scheduledStart: '2025-12-07T10:00:00',
    scheduledEnd: '2025-12-07T11:00:00'
  });

  assert.equal(task.scheduledStart, '2025-12-07T10:00:00');
  assert.equal(task.scheduledEnd, '2025-12-07T11:00:00');
  assert.equal(task.isAllDay, false);

  db.close();
  fs.removeSync(dir);
});

test('createTask() with isAllDay=true', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, {
    title: 'All Day Event',
    bodyMd: 'Body',
    scheduledStart: '2025-12-07T00:00:00',
    scheduledEnd: '2025-12-09T23:59:59',
    isAllDay: true
  });

  assert.equal(task.scheduledStart, '2025-12-07T00:00:00');
  assert.equal(task.scheduledEnd, '2025-12-09T23:59:59');
  assert.equal(task.isAllDay, true);

  db.close();
  fs.removeSync(dir);
});

test('createTask() without scheduling fields has null values', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, {
    title: 'No Schedule',
    bodyMd: 'Body'
  });

  assert.equal(task.scheduledStart, null);
  assert.equal(task.scheduledEnd, null);
  assert.equal(task.isAllDay, false);
  assert.equal(task.actualStart, null);
  assert.equal(task.actualEnd, null);

  db.close();
  fs.removeSync(dir);
});

// T005: Test taskRowToTask mapper reads new columns
test('getTask() returns new datetime fields correctly', () => {
  const { dir, db } = createTempDb();

  // Insert directly with new columns to test mapper
  db.prepare(`
    INSERT INTO issues (type, title, body_md, status, scheduled_start, scheduled_end, is_all_day, actual_start, actual_end, meta, created_at, updated_at, is_bookmarked, is_deleted)
    VALUES ('task', 'Test Task', 'Body', 'done', '2025-12-07T10:00:00', '2025-12-07T11:00:00', 0, '2025-12-07T10:05:00', '2025-12-07T11:30:00', '{}', '2025-12-07T00:00:00', '2025-12-07T00:00:00', 0, 0)
  `).run();

  const row = db.prepare('SELECT id FROM issues WHERE title = ?').get('Test Task') as any;
  const task = getTask(db, row.id);

  assert.equal(task.scheduledStart, '2025-12-07T10:00:00');
  assert.equal(task.scheduledEnd, '2025-12-07T11:00:00');
  assert.equal(task.isAllDay, false);
  assert.equal(task.actualStart, '2025-12-07T10:05:00');
  assert.equal(task.actualEnd, '2025-12-07T11:30:00');

  db.close();
  fs.removeSync(dir);
});

test('listTasks() returns new datetime fields for all tasks', () => {
  const { dir, db } = createTempDb();

  createTask(db, {
    title: 'Task with schedule',
    bodyMd: 'Body',
    scheduledStart: '2025-12-07T14:00:00',
    scheduledEnd: '2025-12-07T15:00:00'
  });

  const tasks = listTasks(db);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].scheduledStart, '2025-12-07T14:00:00');
  assert.equal(tasks[0].scheduledEnd, '2025-12-07T15:00:00');

  db.close();
  fs.removeSync(dir);
});

// T006: Test updateTask with new datetime fields
test('updateTask() with scheduledStart and scheduledEnd', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body' });

  const updated = updateTask(db, {
    id: task.id,
    scheduledStart: '2025-12-08T09:00:00',
    scheduledEnd: '2025-12-08T10:30:00'
  });

  assert.equal(updated.scheduledStart, '2025-12-08T09:00:00');
  assert.equal(updated.scheduledEnd, '2025-12-08T10:30:00');

  db.close();
  fs.removeSync(dir);
});

test('updateTask() with isAllDay toggle', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, {
    title: 'Task',
    bodyMd: 'Body',
    isAllDay: false
  });

  const updated = updateTask(db, {
    id: task.id,
    isAllDay: true,
    scheduledStart: '2025-12-08T00:00:00',
    scheduledEnd: '2025-12-10T23:59:59'
  });

  assert.equal(updated.isAllDay, true);

  db.close();
  fs.removeSync(dir);
});

test('updateTask() with actualStart and actualEnd (manual override)', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, { title: 'Task', bodyMd: 'Body' });

  const updated = updateTask(db, {
    id: task.id,
    actualStart: '2025-12-07T16:00:00',
    actualEnd: '2025-12-07T17:30:00'
  });

  assert.equal(updated.actualStart, '2025-12-07T16:00:00');
  assert.equal(updated.actualEnd, '2025-12-07T17:30:00');

  db.close();
  fs.removeSync(dir);
});

test('updateTask() clears scheduledStart with null', () => {
  const { dir, db } = createTempDb();
  const task = createTask(db, {
    title: 'Task',
    bodyMd: 'Body',
    scheduledStart: '2025-12-07T10:00:00',
    scheduledEnd: '2025-12-07T11:00:00'
  });

  const updated = updateTask(db, {
    id: task.id,
    scheduledStart: null,
    scheduledEnd: null
  });

  assert.equal(updated.scheduledStart, null);
  assert.equal(updated.scheduledEnd, null);

  db.close();
  fs.removeSync(dir);
});

// Test: createTask() with status='next' should auto-set actual_start
test('createTask() with status=next auto-sets actual_start to current datetime', () => {
  const { dir, db } = createTempDb();
  const today = getLocalDate();

  const task = createTask(db, {
    title: 'Next Task',
    bodyMd: 'Body',
    status: 'next'
  });

  assert.equal(task.status, 'next');
  assert.ok(task.actualStart, 'actual_start should be set');
  assert.ok(
    task.actualStart.startsWith(today),
    `actual_start should start with today's date (${today}), got: ${task.actualStart}`
  );
  assert.match(
    task.actualStart,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
    'actual_start should be in ISO 8601 format'
  );

  db.close();
  fs.removeSync(dir);
});

test('createTask() with status=inbox does not set actual_start', () => {
  const { dir, db } = createTempDb();

  const task = createTask(db, {
    title: 'Inbox Task',
    bodyMd: 'Body',
    status: 'inbox'
  });

  assert.equal(task.status, 'inbox');
  assert.equal(task.actualStart, null, 'actual_start should NOT be set for inbox status');

  db.close();
  fs.removeSync(dir);
});

test('createTask() with default status does not set actual_start', () => {
  const { dir, db } = createTempDb();

  const task = createTask(db, {
    title: 'Default Status Task',
    bodyMd: 'Body'
  });

  assert.equal(task.status, 'inbox');
  assert.equal(task.actualStart, null, 'actual_start should NOT be set for default (inbox) status');

  db.close();
  fs.removeSync(dir);
});
