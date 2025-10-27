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

describe('project delete command', () => {
  let tmp, configPath, dbPath, env;

  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-project-delete-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);
  });

  test('delete with --yes flag', () => {
    const createProject = runCli(['project', 'create', 'Test Project', '-j'], { env });
    const projectId = JSON.parse(createProject.stdout).id;

    const result = runCli(['project', 'delete', String(projectId), '--yes', '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const output = JSON.parse(result.stdout);
    assert.equal(output.deleted, true);
    assert.equal(output.projectId, projectId);
  });

  test('delete without --yes in JSON mode shows error', () => {
    const createProject = runCli(['project', 'create', 'No Yes Project', '-j'], { env });
    const projectId = JSON.parse(createProject.stdout).id;

    const result = runCli(['project', 'delete', String(projectId), '-j'], { env });
    assert.equal(result.status, 0);

    const output = JSON.parse(result.stdout);
    assert.equal(output.deleted, false);
    assert.match(output.reason, /requires --yes/i);
  });

  test('delete non-existent project shows error', () => {
    const result = runCli(['project', 'delete', '99999', '--yes', '-j'], { env });
    assert.equal(result.status, 0);

    const output = JSON.parse(result.stdout);
    assert.equal(output.deleted, false);
    assert.ok(output.reason);
  });

  test('cleanup test environment', () => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
