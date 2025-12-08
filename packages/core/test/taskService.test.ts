import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { writeConfig, loadConfig } from 'meme-gtd-config';
import { applyMigrations } from 'meme-gtd-db';
import { TaskService } from '../src/index';

const setupConfig = async (dir: string) => {
  const dbPath = path.join(dir, 'issues.db');
  const configPath = path.join(dir, 'context.json');
  applyMigrations(dbPath);
  await writeConfig({
    dbPath,
    mode: 'local',
    schemaVersion: '001_init',
    updatedAt: new Date().toISOString()
  }, configPath);
  return { dbPath, configPath };
};

// T010: Test TaskService methods - Verify service layer delegation

test('TaskService create and list', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-task-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new TaskService({ config });

  const task = service.create({ title: 'Service Task', bodyMd: 'Task body', labels: ['test'] });
  assert.ok(task.id > 0);
  assert.equal(task.title, 'Service Task');
  assert.equal(task.type, 'task');

  const list = service.list({ label: 'test' });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, task.id);

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('TaskService show', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-task-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new TaskService({ config });

  const task = service.create({ title: 'Show Test', bodyMd: 'Body' });
  const retrieved = service.show(task.id);

  assert.equal(retrieved.id, task.id);
  assert.equal(retrieved.title, 'Show Test');

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('TaskService edit', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-task-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new TaskService({ config });

  const task = service.create({ title: 'Edit Test', bodyMd: 'Original' });
  const updated = service.edit({
    id: task.id,
    title: 'Updated Title',
    bodyMd: 'Updated body',
    status: 'next'
  });

  assert.equal(updated.title, 'Updated Title');
  assert.equal(updated.bodyMd, 'Updated body');
  assert.equal(updated.status, 'next');

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('TaskService remove', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-task-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new TaskService({ config });

  const task = service.create({ title: 'Delete Test', bodyMd: 'To be deleted' });
  service.remove(task.id);

  const list = service.list();
  assert.equal(list.length, 0);

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('TaskService close', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-task-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new TaskService({ config });

  const task = service.create({ title: 'Close Test', bodyMd: 'Body' });
  const closed = service.close(task.id);

  assert.equal(closed.status, 'done');

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('TaskService close with comment', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-task-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new TaskService({ config });

  const task = service.create({ title: 'Close Test', bodyMd: 'Body' });
  service.close(task.id, 'Completed successfully');

  const comments = service.listComments(task.id);
  assert.equal(comments.length, 1);
  assert.equal(comments[0].bodyMd, 'Completed successfully');

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('TaskService cancel', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-task-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new TaskService({ config });

  const task = service.create({ title: 'Cancel Test', bodyMd: 'Body' });
  const canceled = service.cancel(task.id, 'No longer needed');

  assert.equal(canceled.status, 'canceled');

  const comments = service.listComments(task.id);
  assert.equal(comments.length, 1);
  assert.equal(comments[0].bodyMd, 'No longer needed');

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('TaskService reopen', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-task-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new TaskService({ config });

  const task = service.create({ title: 'Reopen Test', bodyMd: 'Body' });
  service.close(task.id);
  const reopened = service.reopen(task.id);

  assert.equal(reopened.status, 'open');

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('TaskService comment methods', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-task-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new TaskService({ config });

  const task = service.create({ title: 'Comment Test', bodyMd: 'Body' });

  // Add comment
  const comment = service.addComment(task.id, 'First comment');
  assert.equal(comment.bodyMd, 'First comment');

  // List comments
  const comments = service.listComments(task.id);
  assert.equal(comments.length, 1);

  // Update comment
  const updated = service.updateComment(comment.id, 'Updated comment');
  assert.equal(updated.bodyMd, 'Updated comment');

  // Delete comment
  service.deleteComment(comment.id);
  const afterDelete = service.listComments(task.id);
  assert.equal(afterDelete.length, 0);

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('TaskService label methods', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-task-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new TaskService({ config });

  const task = service.create({ title: 'Label Test', bodyMd: 'Body', labels: ['initial'] });

  // List labels
  let labels = service.listLabels(task.id);
  assert.deepEqual(labels, ['initial']);

  // Set labels (replace all)
  service.setLabels(task.id, ['new1', 'new2']);
  labels = service.listLabels(task.id);
  assert.deepEqual(labels, ['new1', 'new2']);

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('TaskService bookmark methods', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-task-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new TaskService({ config });

  const task = service.create({ title: 'Bookmark Test', bodyMd: 'Body' });

  // Set bookmark
  service.setBookmark(task.id, true);
  let retrieved = service.show(task.id);
  assert.equal(retrieved.isBookmarked, true);

  // Clear bookmark
  service.setBookmark(task.id, false);
  retrieved = service.show(task.id);
  assert.equal(retrieved.isBookmarked, false);

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('TaskService list returns projectIds and linkIds', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-task-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new TaskService({ config });

  // Create a task
  const task = service.create({ title: 'Task with associations', bodyMd: 'Body' });

  // List tasks and verify projectIds and linkIds are present (empty arrays for now)
  const list = service.list();
  assert.equal(list.length, 1);
  assert.ok(Array.isArray(list[0].projectIds), 'projectIds should be an array');
  assert.ok(Array.isArray(list[0].linkIds), 'linkIds should be an array');
  assert.deepEqual(list[0].projectIds, []);
  assert.deepEqual(list[0].linkIds, []);

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});
