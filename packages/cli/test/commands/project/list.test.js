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

describe('project list command', () => {
  let tmp, configPath, dbPath, env;

  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-project-list-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);
  });

  test('list empty projects shows message', () => {
    const result = runCli(['project', 'list'], { env });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /No projects/i);
  });

  test('list with --json returns array', () => {
    const result = runCli(['project', 'list', '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const output = JSON.parse(result.stdout);
    assert.ok(Array.isArray(output.projects));
    assert.equal(output.projects.length, 0);
  });

  test('list multiple projects', () => {
    runCli(['project', 'create', 'Project 1', '-j'], { env });
    runCli(['project', 'create', 'Project 2', '-j'], { env });

    const result = runCli(['project', 'list', '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const output = JSON.parse(result.stdout);
    assert.equal(output.projects.length, 2);
  });

  test('cleanup test environment', () => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
