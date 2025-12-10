import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase } from '../src/index';
import {
  createActivityLog,
  listActivityLog,
  getByIssueId,
  getByProjectId,
  getCompletedTasks,
} from '../src/activityLogRepository';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-activity-log-test-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

// ============================================================
// User Story 1, Scenario 1: View task history with multiple events
// ============================================================
test('US1-S1: View task history with multiple events in chronological order', () => {
  const { dir, db } = createTempDb();

  // Create multiple events for the same task
  createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'cli',
    payload: { issue_id: 42, title: 'Test Task', status: 'inbox' },
  });

  createActivityLog(db, {
    eventType: 'task.status_changed',
    sourceType: 'cli',
    payload: { issue_id: 42, from_status: 'inbox', to_status: 'open' },
  });

  createActivityLog(db, {
    eventType: 'label.assigned',
    sourceType: 'api',
    payload: { issue_id: 42, label_id: 1, label_name: 'priority-high' },
  });

  // Retrieve history for task 42
  const history = getByIssueId(db, 42, { order: 'asc' });

  assert.equal(history.length, 3);
  assert.equal(history[0].eventType, 'task.created');
  assert.equal(history[1].eventType, 'task.status_changed');
  assert.equal(history[2].eventType, 'label.assigned');

  // Verify chronological order
  assert.ok(new Date(history[0].occurredAt) <= new Date(history[1].occurredAt));
  assert.ok(new Date(history[1].occurredAt) <= new Date(history[2].occurredAt));

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// User Story 1, Scenario 2: View task history after creation
// ============================================================
test('US1-S2: View task history immediately after creation shows single event', () => {
  const { dir, db } = createTempDb();

  createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'cli',
    payload: { issue_id: 100, title: 'New Task', status: 'inbox' },
  });

  const history = getByIssueId(db, 100);

  assert.equal(history.length, 1);
  assert.equal(history[0].eventType, 'task.created');
  assert.equal(history[0].payload.title, 'New Task');

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// User Story 1, Scenario 3: Verify status change records before/after values
// ============================================================
test('US1-S3: Status change event records both from_status and to_status', () => {
  const { dir, db } = createTempDb();

  const entry = createActivityLog(db, {
    eventType: 'task.status_changed',
    sourceType: 'api',
    payload: {
      issue_id: 42,
      title: 'Task Title',
      from_status: 'open',
      to_status: 'done',
      project_snapshot: [{ id: 5, name: 'Project Alpha' }],
      label_snapshot: [{ id: 1, name: 'backend' }],
    },
  });

  assert.equal(entry.eventType, 'task.status_changed');
  assert.equal(entry.payload.from_status, 'open');
  assert.equal(entry.payload.to_status, 'done');
  assert.equal(entry.issueId, 42);

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// Generated Columns verification
// ============================================================
test('Generated columns are correctly extracted from payload', () => {
  const { dir, db } = createTempDb();

  const entry = createActivityLog(db, {
    eventType: 'project.item_added',
    sourceType: 'api',
    payload: {
      project_id: 10,
      project_name: 'Test Project',
      issue_id: 42,
      issue_type: 'task',
    },
  });

  assert.equal(entry.issueId, 42);
  assert.equal(entry.projectId, 10);
  assert.equal(entry.labelId, null);
  assert.equal(entry.linkId, null);
  assert.equal(entry.commentId, null);

  db.close();
  fs.removeSync(dir);
});

test('Can query by generated column issue_id', () => {
  const { dir, db } = createTempDb();

  // Create events for different issues
  createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'cli',
    payload: { issue_id: 1, title: 'Task 1' },
  });

  createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'cli',
    payload: { issue_id: 2, title: 'Task 2' },
  });

  createActivityLog(db, {
    eventType: 'task.updated',
    sourceType: 'api',
    payload: { issue_id: 1, title: 'Task 1 Updated' },
  });

  // Query for issue 1 only
  const issue1History = listActivityLog(db, { issueId: 1 });
  assert.equal(issue1History.length, 2);
  issue1History.forEach((entry) => {
    assert.equal(entry.issueId, 1);
  });

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// User Story 2, Scenario 1: View project activity across multiple tasks
// ============================================================
test('US2-S1: View project activity across multiple tasks', () => {
  const { dir, db } = createTempDb();

  // Create events for different tasks in the same project
  createActivityLog(db, {
    eventType: 'project.item_added',
    sourceType: 'api',
    payload: { project_id: 5, issue_id: 10, issue_title: 'Task A' },
  });

  createActivityLog(db, {
    eventType: 'project.item_added',
    sourceType: 'api',
    payload: { project_id: 5, issue_id: 11, issue_title: 'Task B' },
  });

  createActivityLog(db, {
    eventType: 'task.status_changed',
    sourceType: 'cli',
    payload: { project_id: 5, issue_id: 10, to_status: 'done' },
  });

  // Query by project_id
  const projectActivity = getByProjectId(db, 5);
  assert.equal(projectActivity.length, 3);

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// User Story 2, Scenario 2: Verify project.item_added event recorded
// ============================================================
test('US2-S2: project.item_added event is correctly recorded', () => {
  const { dir, db } = createTempDb();

  const entry = createActivityLog(db, {
    eventType: 'project.item_added',
    sourceType: 'api',
    payload: {
      project_id: 5,
      project_name: 'meme-gtd v2.0',
      issue_id: 42,
      issue_type: 'task',
      issue_title: 'New Feature',
      position: 1.5,
    },
  });

  assert.equal(entry.eventType, 'project.item_added');
  assert.equal(entry.projectId, 5);
  assert.equal(entry.issueId, 42);
  assert.equal(entry.payload.project_name, 'meme-gtd v2.0');
  assert.equal(entry.payload.position, 1.5);

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// User Story 3, Scenario 1: Filter completed tasks by today's date
// ============================================================
test('US3-S1: Filter completed tasks by date range', () => {
  const { dir, db } = createTempDb();

  // Create completed task events
  createActivityLog(db, {
    eventType: 'task.status_changed',
    sourceType: 'cli',
    payload: {
      issue_id: 1,
      title: 'Task 1',
      from_status: 'open',
      to_status: 'done',
    },
  });

  createActivityLog(db, {
    eventType: 'task.status_changed',
    sourceType: 'api',
    payload: {
      issue_id: 2,
      title: 'Task 2',
      from_status: 'next',
      to_status: 'done',
    },
  });

  // Also create a non-completion event (should not be included)
  createActivityLog(db, {
    eventType: 'task.status_changed',
    sourceType: 'cli',
    payload: {
      issue_id: 3,
      title: 'Task 3',
      from_status: 'open',
      to_status: 'next',
    },
  });

  const today = new Date().toISOString().split('T')[0];
  const completedTasks = getCompletedTasks(db, { from: today, to: today });

  assert.equal(completedTasks.length, 2);
  completedTasks.forEach((task) => {
    assert.ok(task.taskId > 0);
    assert.ok(task.title);
    assert.ok(task.completedAt);
  });

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// User Story 3, Scenario 2: Handle empty result for no completions
// ============================================================
test('US3-S2: Returns empty array when no tasks completed in date range', () => {
  const { dir, db } = createTempDb();

  // Create a non-completion event
  createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'cli',
    payload: { issue_id: 1, title: 'Task 1' },
  });

  const completedTasks = getCompletedTasks(db, {
    from: '2020-01-01',
    to: '2020-01-01',
  });

  assert.equal(completedTasks.length, 0);

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// User Story 4, Scenario 1: Filter by source_type
// ============================================================
test('US4-S1: Filter activity log by source_type', () => {
  const { dir, db } = createTempDb();

  createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'cli',
    payload: { issue_id: 1 },
  });

  createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'api',
    payload: { issue_id: 2 },
  });

  createActivityLog(db, {
    eventType: 'task.updated',
    sourceType: 'cli',
    payload: { issue_id: 1 },
  });

  const cliOnly = listActivityLog(db, { sourceType: 'cli' });
  assert.equal(cliOnly.length, 2);
  cliOnly.forEach((entry) => {
    assert.equal(entry.sourceType, 'cli');
  });

  const apiOnly = listActivityLog(db, { sourceType: 'api' });
  assert.equal(apiOnly.length, 1);
  assert.equal(apiOnly[0].sourceType, 'api');

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// Additional filter tests
// ============================================================
test('Filter by eventType', () => {
  const { dir, db } = createTempDb();

  createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'cli',
    payload: { issue_id: 1 },
  });

  createActivityLog(db, {
    eventType: 'task.status_changed',
    sourceType: 'cli',
    payload: { issue_id: 1 },
  });

  const statusChangedOnly = listActivityLog(db, {
    eventType: 'task.status_changed',
  });
  assert.equal(statusChangedOnly.length, 1);
  assert.equal(statusChangedOnly[0].eventType, 'task.status_changed');

  db.close();
  fs.removeSync(dir);
});

test('Pagination with limit and offset', () => {
  const { dir, db } = createTempDb();

  // Create 5 events
  for (let i = 1; i <= 5; i++) {
    createActivityLog(db, {
      eventType: 'task.created',
      sourceType: 'cli',
      payload: { issue_id: i },
    });
  }

  const page1 = listActivityLog(db, { limit: 2, offset: 0, order: 'asc' });
  const page2 = listActivityLog(db, { limit: 2, offset: 2, order: 'asc' });
  const page3 = listActivityLog(db, { limit: 2, offset: 4, order: 'asc' });

  assert.equal(page1.length, 2);
  assert.equal(page2.length, 2);
  assert.equal(page3.length, 1);

  // Verify no overlap
  const allIds = [...page1, ...page2, ...page3].map((e) => e.id);
  const uniqueIds = new Set(allIds);
  assert.equal(uniqueIds.size, 5);

  db.close();
  fs.removeSync(dir);
});

test('Date range filter', () => {
  const { dir, db } = createTempDb();

  // Directly insert with specific dates for testing
  const stmt = db.prepare(`
    INSERT INTO activity_log (event_type, occurred_at, source_type, payload)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run('task.created', '2025-01-01T10:00:00.000Z', 'cli', '{"issue_id": 1}');
  stmt.run('task.created', '2025-01-15T10:00:00.000Z', 'cli', '{"issue_id": 2}');
  stmt.run('task.created', '2025-02-01T10:00:00.000Z', 'cli', '{"issue_id": 3}');

  const januaryOnly = listActivityLog(db, {
    from: '2025-01-01T00:00:00.000Z',
    to: '2025-01-31T23:59:59.999Z',
  });

  assert.equal(januaryOnly.length, 2);

  db.close();
  fs.removeSync(dir);
});
