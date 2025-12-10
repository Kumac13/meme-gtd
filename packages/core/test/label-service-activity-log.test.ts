import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase, listActivityLog, createTask } from 'meme-gtd-db';
import { LabelService } from '../src/index.js';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-label-log-test-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

// ============================================================
// LabelService Activity Log Integration Tests
// ============================================================

test('LabelService.create() logs label.created event', () => {
  const { dir, db } = createTempDb();
  const labelService = new LabelService({ db });

  // Create a label
  const label = labelService.create('test-label', 'Test description');

  // Verify activity log entry
  const logs = listActivityLog(db, {});
  assert.equal(logs.length, 1);
  assert.equal(logs[0].eventType, 'label.created');
  assert.equal(logs[0].sourceType, 'api');
  assert.equal(logs[0].payload.label_id, label.id);
  assert.equal(logs[0].payload.label_name, 'test-label');

  db.close();
  fs.removeSync(dir);
});

test('LabelService.delete() logs label.deleted event', () => {
  const { dir, db } = createTempDb();
  const labelService = new LabelService({ db });

  // Create then delete a label
  const label = labelService.create('to-delete');
  labelService.delete('to-delete');

  // Verify activity log entries (order: asc to get chronological order)
  const logs = listActivityLog(db, { order: 'asc' });
  assert.equal(logs.length, 2);
  assert.equal(logs[0].eventType, 'label.created');
  assert.equal(logs[1].eventType, 'label.deleted');
  assert.equal(logs[1].payload.label_id, label.id);

  db.close();
  fs.removeSync(dir);
});

test('LabelService.assignToIssue() logs label.assigned event', () => {
  const { dir, db } = createTempDb();
  const labelService = new LabelService({ db });

  // Create label and task
  const label = labelService.create('test-label');
  const task = createTask(db, { title: 'Test Task', bodyMd: '' });

  // Assign label to task
  labelService.assignToIssue(task.id, label.id);

  // Verify activity log entries
  const logs = listActivityLog(db, { order: 'asc' });
  const assignLog = logs.find(l => l.eventType === 'label.assigned');
  assert.ok(assignLog, 'label.assigned event should exist');
  assert.equal(assignLog.payload.label_id, label.id);
  assert.equal(assignLog.payload.issue_id, task.id);

  db.close();
  fs.removeSync(dir);
});

test('LabelService.removeFromIssue() logs label.removed event', () => {
  const { dir, db } = createTempDb();
  const labelService = new LabelService({ db });

  // Create label and task, assign then remove
  const label = labelService.create('test-label');
  const task = createTask(db, { title: 'Test Task', bodyMd: '' });
  labelService.assignToIssue(task.id, label.id);
  labelService.removeFromIssue(task.id, label.id);

  // Verify activity log entries
  const logs = listActivityLog(db, { order: 'asc' });
  const removeLog = logs.find(l => l.eventType === 'label.removed');
  assert.ok(removeLog, 'label.removed event should exist');
  assert.equal(removeLog.payload.label_id, label.id);
  assert.equal(removeLog.payload.issue_id, task.id);

  db.close();
  fs.removeSync(dir);
});

test('LabelService uses cli sourceType when specified', () => {
  const { dir, db } = createTempDb();
  const labelService = new LabelService({ db, sourceType: 'cli' });

  labelService.create('cli-label');

  const logs = listActivityLog(db, {});
  assert.equal(logs.length, 1);
  assert.equal(logs[0].sourceType, 'cli');

  db.close();
  fs.removeSync(dir);
});
