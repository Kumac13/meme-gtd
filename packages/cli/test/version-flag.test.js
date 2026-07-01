import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, describe } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

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

describe('version flag handling', () => {
  let tmp, configPath, dbPath, env;

  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-version-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);
  });

  test('-v as first token prints version', () => {
    const result = runCli(['-v'], { env });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), pkg.version);
  });

  test('--version as first token prints version', () => {
    const result = runCli(['--version'], { env });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), pkg.version);
  });

  test('-v after a command is passed through as a command flag', () => {
    const result = runCli(['project', 'create', 'Version Flag Project', '-v', 'table', '-j'], {
      env
    });
    assert.equal(result.status, 0, result.stderr);

    const project = JSON.parse(result.stdout);
    assert.equal(project.name, 'Version Flag Project');
    assert.equal(project.viewMeta.viewType, 'table');
  });

  test('cleanup test environment', () => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
