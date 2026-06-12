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

const setup = () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-init-guard-'));
  const configPath = path.join(tmp, 'context.json');
  const dbPath = path.join(tmp, 'issues.db');
  const env = {
    ...process.env,
    MGTD_CONFIG_PATH: configPath
  };
  return { configPath, dbPath, env };
};

test('init --force on existing DB is refused in non-interactive mode', () => {
  const { dbPath, env } = setup();

  const first = runCli(['init', '-d', dbPath, '-j'], { env });
  assert.equal(first.status, 0, first.stderr);
  const sizeBefore = fs.statSync(dbPath).size;

  // spawnSync uses pipes for stdio, so the child is non-TTY
  const second = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
  assert.equal(second.status, 1);
  assert.match(second.stdout, /Refusing to overwrite existing database in non-interactive mode/);

  // The existing database must be untouched
  assert.equal(fs.statSync(dbPath).size, sizeBefore);
});

test('init --force --yes on existing DB succeeds in non-interactive mode', () => {
  const { dbPath, env } = setup();

  const first = runCli(['init', '-d', dbPath, '-j'], { env });
  assert.equal(first.status, 0, first.stderr);

  const second = runCli(['init', '-d', dbPath, '-f', '--yes', '-j'], { env });
  assert.equal(second.status, 0, second.stderr);
  const payload = JSON.parse(second.stdout);
  assert.equal(payload.dbPath, dbPath);
  assert.ok(fs.existsSync(dbPath));
});

test('init --force on missing DB does not require --yes', () => {
  const { dbPath, env } = setup();

  const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
  assert.equal(init.status, 0, init.stderr);
  assert.ok(fs.existsSync(dbPath));
});

test('MGTD_ENV=test refuses to fall back to the production database path', () => {
  const { env } = setup();

  // No DB_PATH and a missing config file would resolve to the production
  // default (~/.local/share/mgtd/issues.db); MGTD_ENV=test must reject that.
  const result = runCli(['task', 'list', '-j'], {
    env: { ...env, MGTD_ENV: 'test', DB_PATH: '' }
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}${result.stdout}`, /Refusing to continue/);
});
