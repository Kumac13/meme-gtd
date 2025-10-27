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

describe('project create command', () => {
  let tmp, configPath, dbPath, env;

  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-project-create-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);
  });

  test('create project with name only', () => {
    const result = runCli(['project', 'create', 'Test Project', '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const output = JSON.parse(result.stdout);
    assert.ok(output.id);
    assert.equal(output.name, 'Test Project');
    assert.equal(output.viewMeta.viewType, 'board');
  });

  test('create with --description flag', () => {
    const result = runCli(['project', 'create', 'Desc Project', '--description', 'Test description', '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const output = JSON.parse(result.stdout);
    assert.equal(output.description, 'Test description');
  });

  test('create with --view table', () => {
    const result = runCli(['project', 'create', 'Table Project', '--view', 'table', '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const output = JSON.parse(result.stdout);
    assert.equal(output.viewMeta.viewType, 'table');
  });

  test('duplicate name shows error', () => {
    runCli(['project', 'create', 'Duplicate', '-j'], { env });
    const result = runCli(['project', 'create', 'Duplicate', '-j'], { env });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /already exists|conflict/i);
  });

  test('cleanup test environment', () => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
