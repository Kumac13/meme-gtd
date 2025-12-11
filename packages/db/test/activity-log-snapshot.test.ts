import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase } from '../src/index';
import { createActivityLog, getByIssueId } from '../src/activityLogRepository';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-snapshot-test-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

// ============================================================
// User Story 5, Scenario 1: Snapshot preserves old project name
// ============================================================
test('US5-S1: Snapshot preserves project name at event time', () => {
  const { dir, db } = createTempDb();

  // Record event with project snapshot showing "Alpha"
  createActivityLog(db, {
    eventType: 'project.item_added',
    sourceType: 'api',
    payload: {
      project_id: 5,
      project_name: 'Alpha', // Name at time of event
      issue_id: 42,
      issue_type: 'task',
      issue_title: 'Test Task',
    },
  });

  // Simulate project name change by creating another event
  // (In reality, the project table would be updated)
  // The important thing is that the OLD event still shows "Alpha"
  createActivityLog(db, {
    eventType: 'task.status_changed',
    sourceType: 'api',
    payload: {
      issue_id: 42,
      title: 'Test Task',
      from_status: 'open',
      to_status: 'done',
      // Project snapshot now shows new name "Beta"
      project_snapshot: [{ id: 5, name: 'Beta' }],
      label_snapshot: [],
    },
  });

  // Retrieve history
  const history = getByIssueId(db, 42, { order: 'asc' });

  // First event should still show "Alpha"
  assert.equal(history[0].eventType, 'project.item_added');
  assert.equal(history[0].payload.project_name, 'Alpha');

  // Second event shows "Beta" (current name at that time)
  assert.equal(history[1].eventType, 'task.status_changed');
  assert.equal(history[1].payload.project_snapshot[0].name, 'Beta');

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// User Story 5, Scenario 2: Snapshot preserves old label name
// ============================================================
test('US5-S2: Snapshot preserves label name at event time', () => {
  const { dir, db } = createTempDb();

  // Record event with label snapshot showing "urgent"
  createActivityLog(db, {
    eventType: 'label.assigned',
    sourceType: 'cli',
    payload: {
      issue_id: 42,
      issue_type: 'task',
      issue_title: 'Important Task',
      label_id: 3,
      label_name: 'urgent', // Name at time of event
    },
  });

  // Record another event after label rename (would be "critical" in real scenario)
  createActivityLog(db, {
    eventType: 'task.status_changed',
    sourceType: 'api',
    payload: {
      issue_id: 42,
      title: 'Important Task',
      from_status: 'open',
      to_status: 'done',
      project_snapshot: [],
      // Label snapshot now shows new name "critical"
      label_snapshot: [{ id: 3, name: 'critical' }],
    },
  });

  // Retrieve history
  const history = getByIssueId(db, 42, { order: 'asc' });

  // First event should still show "urgent"
  assert.equal(history[0].eventType, 'label.assigned');
  assert.equal(history[0].payload.label_name, 'urgent');

  // Second event shows "critical" (current name at that time)
  assert.equal(history[1].eventType, 'task.status_changed');
  assert.equal(history[1].payload.label_snapshot[0].name, 'critical');

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// Snapshot integrity tests
// ============================================================
test('Multiple label snapshots are preserved in status change', () => {
  const { dir, db } = createTempDb();

  createActivityLog(db, {
    eventType: 'task.status_changed',
    sourceType: 'api',
    payload: {
      issue_id: 42,
      title: 'Multi-label Task',
      from_status: 'open',
      to_status: 'done',
      project_snapshot: [
        { id: 1, name: 'Project A' },
        { id: 2, name: 'Project B' },
      ],
      label_snapshot: [
        { id: 1, name: 'backend' },
        { id: 2, name: 'priority-high' },
        { id: 3, name: 'reviewed' },
      ],
    },
  });

  const history = getByIssueId(db, 42);

  assert.equal(history.length, 1);
  assert.equal(history[0].payload.project_snapshot.length, 2);
  assert.equal(history[0].payload.label_snapshot.length, 3);

  // Verify specific snapshots
  const projectNames = history[0].payload.project_snapshot.map(
    (p: { name: string }) => p.name
  );
  assert.ok(projectNames.includes('Project A'));
  assert.ok(projectNames.includes('Project B'));

  const labelNames = history[0].payload.label_snapshot.map(
    (l: { name: string }) => l.name
  );
  assert.ok(labelNames.includes('backend'));
  assert.ok(labelNames.includes('priority-high'));
  assert.ok(labelNames.includes('reviewed'));

  db.close();
  fs.removeSync(dir);
});

test('Issue title snapshot is preserved', () => {
  const { dir, db } = createTempDb();

  // Create task with initial title
  createActivityLog(db, {
    eventType: 'task.created',
    sourceType: 'cli',
    payload: {
      issue_id: 42,
      issue_type: 'task',
      title: 'Original Title',
      status: 'inbox',
    },
  });

  // Record label assignment with title snapshot
  createActivityLog(db, {
    eventType: 'label.assigned',
    sourceType: 'api',
    payload: {
      issue_id: 42,
      issue_type: 'task',
      issue_title: 'Original Title', // Snapshot at assignment time
      label_id: 1,
      label_name: 'important',
    },
  });

  // If title were updated, this event would show the new title
  // but the label.assigned event still shows the old title
  createActivityLog(db, {
    eventType: 'task.updated',
    sourceType: 'api',
    payload: {
      issue_id: 42,
      title: 'Updated Title', // New title
    },
  });

  const history = getByIssueId(db, 42, { order: 'asc' });

  // label.assigned event should still show original title
  assert.equal(history[1].eventType, 'label.assigned');
  assert.equal(history[1].payload.issue_title, 'Original Title');

  // task.updated event shows new title
  assert.equal(history[2].eventType, 'task.updated');
  assert.equal(history[2].payload.title, 'Updated Title');

  db.close();
  fs.removeSync(dir);
});

test('Memo promotion snapshot preserves source memo body preview', () => {
  const { dir, db } = createTempDb();

  const longMemoBody =
    'This is a very long memo body that exceeds the preview limit. ' +
    'It contains important information that should be truncated when ' +
    'creating the activity log entry. Only the first 100 characters ' +
    'should be preserved in the snapshot.';

  createActivityLog(db, {
    eventType: 'memo.promoted',
    sourceType: 'api',
    payload: {
      issue_id: 100,
      source_memo_id: 50,
      source_memo_body_preview: longMemoBody.substring(0, 100) + '...',
      promoted_task: {
        id: 100,
        title: 'Promoted Task Title',
        status: 'inbox',
      },
      link_id: 25,
    },
  });

  const history = getByIssueId(db, 100);

  assert.equal(history.length, 1);
  assert.equal(history[0].eventType, 'memo.promoted');
  assert.equal(history[0].payload.source_memo_id, 50);
  assert.ok(history[0].payload.source_memo_body_preview.length <= 104); // 100 + "..."
  assert.equal(history[0].payload.promoted_task.title, 'Promoted Task Title');

  db.close();
  fs.removeSync(dir);
});
