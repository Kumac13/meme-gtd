import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, describe } from 'node:test';

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

describe('project move command', () => {
  let tmp, configPath, dbPath, env;

  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-project-move-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);
  });

  test('move with --position', () => {
    const createProject = runCli(['project', 'create', 'Test Project', '-j'], { env });
    const projectId = JSON.parse(createProject.stdout).id;

    const createTask = runCli(['task', 'create', '-t', 'Test Task', '--no-editor', '-j'], { env });
    const taskId = JSON.parse(createTask.stdout).task.id;

    runCli(['project', 'add', String(projectId), String(taskId), '-j'], { env });

    const result = runCli(['project', 'move', String(projectId), String(taskId), '--position', '5.5', '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const output = JSON.parse(result.stdout);
    assert.equal(output.position, 5.5);
  });

  test('move with --column', () => {
    const createProject = runCli(['project', 'create', 'Column Project', '-j'], { env });
    const projectId = JSON.parse(createProject.stdout).id;

    const createTask = runCli(['task', 'create', '-t', 'Column Task', '--no-editor', '-j'], { env });
    const taskId = JSON.parse(createTask.stdout).task.id;

    runCli(['project', 'add', String(projectId), String(taskId), '-j'], { env });

    const result = runCli(['project', 'move', String(projectId), String(taskId), '--column', 'Done', '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const output = JSON.parse(result.stdout);
    assert.ok(output.viewMeta);
    assert.equal(output.viewMeta.column, 'Done');
  });

  test('move without flags shows error', () => {
    const createProject = runCli(['project', 'create', 'Error Project', '-j'], { env });
    const projectId = JSON.parse(createProject.stdout).id;

    const createTask = runCli(['task', 'create', '-t', 'Error Task', '--no-editor', '-j'], { env });
    const taskId = JSON.parse(createTask.stdout).task.id;

    runCli(['project', 'add', String(projectId), String(taskId), '-j'], { env });

    const result = runCli(['project', 'move', String(projectId), String(taskId), '-j'], { env });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /at least one/i);
  });

  test('cleanup test environment', () => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
