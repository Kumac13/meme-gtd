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

describe('project remove command', () => {
  let tmp, configPath, dbPath, env;

  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-project-remove-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);
  });

  test('remove with --yes flag', () => {
    const createProject = runCli(['project', 'create', 'Test Project', '-j'], { env });
    const projectId = JSON.parse(createProject.stdout).id;

    const createTask = runCli(['task', 'create', '-t', 'Test Task', '--no-editor', '-j'], { env });
    const taskId = JSON.parse(createTask.stdout).task.id;

    runCli(['project', 'add', String(projectId), String(taskId), '-j'], { env });

    const result = runCli(['project', 'remove', String(projectId), String(taskId), '--yes', '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const output = JSON.parse(result.stdout);
    assert.equal(output.removed, true);
    assert.equal(output.projectId, projectId);
    assert.equal(output.issueId, taskId);
  });

  test('remove without --yes in JSON mode shows error', () => {
    const createProject = runCli(['project', 'create', 'No Yes Project', '-j'], { env });
    const projectId = JSON.parse(createProject.stdout).id;

    const createTask = runCli(['task', 'create', '-t', 'No Yes Task', '--no-editor', '-j'], { env });
    const taskId = JSON.parse(createTask.stdout).task.id;

    runCli(['project', 'add', String(projectId), String(taskId), '-j'], { env });

    const result = runCli(['project', 'remove', String(projectId), String(taskId), '-j'], { env });
    assert.equal(result.status, 0);

    const output = JSON.parse(result.stdout);
    assert.equal(output.removed, false);
    assert.match(output.reason, /requires --yes/i);
  });

  test('remove non-existent issue shows error', () => {
    const createProject = runCli(['project', 'create', 'Error Project', '-j'], { env });
    const projectId = JSON.parse(createProject.stdout).id;

    const result = runCli(['project', 'remove', String(projectId), '99999', '--yes', '-j'], { env });
    assert.equal(result.status, 0);

    const output = JSON.parse(result.stdout);
    assert.equal(output.removed, false);
    assert.ok(output.reason);
  });

  test('cleanup test environment', () => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
