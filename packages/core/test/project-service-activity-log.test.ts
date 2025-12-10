import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase, listActivityLog, createTask } from 'meme-gtd-db';
import { ProjectService } from '../src/projectService.js';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-project-log-test-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

// ============================================================
// ProjectService Activity Log Integration Tests
// ============================================================

test('ProjectService.create() logs project.created event', () => {
  const { dir, db } = createTempDb();
  const projectService = new ProjectService({ db });

  // Create a project
  const project = projectService.create({ name: 'Test Project' });

  // Verify activity log entry
  const logs = listActivityLog(db, {});
  assert.equal(logs.length, 1);
  assert.equal(logs[0].eventType, 'project.created');
  assert.equal(logs[0].sourceType, 'api');
  assert.equal(logs[0].payload.project_id, project.id);
  assert.equal(logs[0].payload.project_name, 'Test Project');

  db.close();
  fs.removeSync(dir);
});

test('ProjectService.update() logs project.updated event', () => {
  const { dir, db } = createTempDb();
  const projectService = new ProjectService({ db });

  // Create then update a project
  const project = projectService.create({ name: 'Original Name' });
  projectService.update(project.id, { name: 'Updated Name' });

  // Verify activity log entries (order: asc to get chronological order)
  const logs = listActivityLog(db, { order: 'asc' });
  assert.equal(logs.length, 2);
  assert.equal(logs[0].eventType, 'project.created');
  assert.equal(logs[1].eventType, 'project.updated');
  assert.equal(logs[1].payload.project_id, project.id);

  db.close();
  fs.removeSync(dir);
});

test('ProjectService.delete() logs project.deleted event', () => {
  const { dir, db } = createTempDb();
  const projectService = new ProjectService({ db });

  // Create then delete a project
  const project = projectService.create({ name: 'To Delete' });
  projectService.delete(project.id);

  // Verify activity log entries (order: asc to get chronological order)
  const logs = listActivityLog(db, { order: 'asc' });
  assert.equal(logs.length, 2);
  assert.equal(logs[0].eventType, 'project.created');
  assert.equal(logs[1].eventType, 'project.deleted');
  assert.equal(logs[1].payload.project_id, project.id);

  db.close();
  fs.removeSync(dir);
});

test('ProjectService.addItem() logs project.item_added event', () => {
  const { dir, db } = createTempDb();
  const projectService = new ProjectService({ db });

  // Create project and task
  const project = projectService.create({ name: 'Test Project' });
  const task = createTask(db, { title: 'Test Task', bodyMd: '' });

  // Add task to project
  projectService.addItem(project.id, { issueId: task.id });

  // Verify activity log entries (order: asc to get chronological order)
  const logs = listActivityLog(db, { order: 'asc' });
  const addLog = logs.find(l => l.eventType === 'project.item_added');
  assert.ok(addLog, 'project.item_added event should exist');
  assert.equal(addLog.payload.project_id, project.id);
  assert.equal(addLog.payload.issue_id, task.id);

  db.close();
  fs.removeSync(dir);
});

test('ProjectService.removeItem() logs project.item_removed event', () => {
  const { dir, db } = createTempDb();
  const projectService = new ProjectService({ db });

  // Create project and task, add task to project
  const project = projectService.create({ name: 'Test Project' });
  const task = createTask(db, { title: 'Test Task', bodyMd: '' });
  projectService.addItem(project.id, { issueId: task.id });

  // Remove task from project
  projectService.removeItem(project.id, task.id);

  // Verify activity log entries (order: asc to get chronological order)
  const logs = listActivityLog(db, { order: 'asc' });
  const removeLog = logs.find(l => l.eventType === 'project.item_removed');
  assert.ok(removeLog, 'project.item_removed event should exist');
  assert.equal(removeLog.payload.project_id, project.id);
  assert.equal(removeLog.payload.issue_id, task.id);

  db.close();
  fs.removeSync(dir);
});

test('ProjectService uses cli sourceType when specified', () => {
  const { dir, db } = createTempDb();
  const projectService = new ProjectService({ db, sourceType: 'cli' });

  projectService.create({ name: 'CLI Project' });

  const logs = listActivityLog(db, {});
  assert.equal(logs.length, 1);
  assert.equal(logs[0].sourceType, 'cli');

  db.close();
  fs.removeSync(dir);
});
