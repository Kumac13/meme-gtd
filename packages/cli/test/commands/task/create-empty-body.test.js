import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const cliDist = path.resolve(process.cwd(), 'dist', 'index.js');

const runCli = (argv, options = {}) => {
  const result = spawnSync(process.execPath, [cliDist, ...argv], {
    encoding: 'utf8',
    env: options.env ?? process.env
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status
  };
};

test('mgtd task create with --body "" succeeds', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-empty-body-'));
  const configPath = path.join(tmp, 'context.json');
  const dbPath = path.join(tmp, 'issues.db');
  const env = {
    ...process.env,
    MGTD_CONFIG_PATH: configPath
  };

  // Init
  const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
  assert.equal(init.status, 0, init.stderr);

  // Create task with empty body
  const create = runCli(['task', 'create', '-t', 'Empty body test', '-b', '', '--no-editor', '-j'], { env });
  assert.equal(create.status, 0, create.stderr);
  const created = JSON.parse(create.stdout);
  assert.equal(created.task.bodyMd, '');
  assert.equal(created.task.title, 'Empty body test');
});

test('mgtd task create with --no-editor (body omitted) succeeds', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-no-body-'));
  const configPath = path.join(tmp, 'context.json');
  const dbPath = path.join(tmp, 'issues.db');
  const env = {
    ...process.env,
    MGTD_CONFIG_PATH: configPath
  };

  // Init
  const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
  assert.equal(init.status, 0, init.stderr);

  // Create task without body option
  const create = runCli(['task', 'create', '-t', 'No body option test', '--no-editor', '-j'], { env });
  assert.equal(create.status, 0, create.stderr);
  const created = JSON.parse(create.stdout);
  assert.equal(created.task.bodyMd, '');
  assert.equal(created.task.title, 'No body option test');
});

test('mgtd task view displays "(no body)" placeholder for empty body', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-view-placeholder-'));
  const configPath = path.join(tmp, 'context.json');
  const dbPath = path.join(tmp, 'issues.db');
  const env = {
    ...process.env,
    MGTD_CONFIG_PATH: configPath
  };

  // Init
  const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
  assert.equal(init.status, 0, init.stderr);

  // Create task with empty body
  const create = runCli(['task', 'create', '-t', 'Placeholder test', '-b', '', '--no-editor', '-j'], { env });
  assert.equal(create.status, 0, create.stderr);
  const created = JSON.parse(create.stdout);
  const taskId = created.task.id;

  // View task (human-readable format)
  const view = runCli(['task', 'view', String(taskId)], { env });
  assert.equal(view.status, 0, view.stderr);
  assert.match(view.stdout, /\(no body\)/);

  // View task (JSON format) - should show bodyMd: ""
  const viewJson = runCli(['task', 'view', String(taskId), '-j'], { env });
  assert.equal(viewJson.status, 0, viewJson.stderr);
  const viewData = JSON.parse(viewJson.stdout);
  assert.equal(viewData.task.bodyMd, '');
});
