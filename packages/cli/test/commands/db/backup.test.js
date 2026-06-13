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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-db-backup-'));
  const configPath = path.join(tmp, 'context.json');
  const dbPath = path.join(tmp, 'issues.db');
  const env = {
    ...process.env,
    MGTD_CONFIG_PATH: configPath
  };
  const init = runCli(['init', '-d', dbPath, '-j'], { env });
  assert.equal(init.status, 0, init.stderr);
  return { tmp, dbPath, env };
};

test('db backup creates a snapshot in <db dir>/backups by default', () => {
  const { tmp, dbPath, env } = setup();

  const backup = runCli(['db', 'backup', '-d', dbPath, '-j'], { env });
  assert.equal(backup.status, 0, backup.stderr);
  const payload = JSON.parse(backup.stdout);
  assert.equal(payload.success, true);
  assert.equal(path.dirname(payload.backupPath), path.join(tmp, 'backups'));
  assert.ok(fs.existsSync(payload.backupPath));
  assert.ok(payload.sizeBytes > 0);
});

test('db backup --list shows existing backups newest first', () => {
  const { dbPath, env } = setup();

  const first = runCli(['db', 'backup', '-d', dbPath, '-j'], { env });
  assert.equal(first.status, 0, first.stderr);
  const second = runCli(['db', 'backup', '-d', dbPath, '-j'], { env });
  assert.equal(second.status, 0, second.stderr);

  const list = runCli(['db', 'backup', '-d', dbPath, '--list', '-j'], { env });
  assert.equal(list.status, 0, list.stderr);
  const payload = JSON.parse(list.stdout);
  assert.equal(payload.backups.length, 2);
  assert.equal(payload.backups[0].path, JSON.parse(second.stdout).backupPath);
});

test('db backup --keep prunes older generations', () => {
  const { dbPath, env } = setup();

  for (let i = 0; i < 3; i += 1) {
    const backup = runCli(['db', 'backup', '-d', dbPath, '--keep', '2', '-j'], { env });
    assert.equal(backup.status, 0, backup.stderr);
  }

  const list = runCli(['db', 'backup', '-d', dbPath, '--list', '-j'], { env });
  const payload = JSON.parse(list.stdout);
  assert.equal(payload.backups.length, 2);
});

test('db backup --output stores backups in the given directory', () => {
  const { tmp, dbPath, env } = setup();
  const outDir = path.join(tmp, 'custom-backups');

  const backup = runCli(['db', 'backup', '-d', dbPath, '-o', outDir, '-j'], { env });
  assert.equal(backup.status, 0, backup.stderr);
  const payload = JSON.parse(backup.stdout);
  assert.equal(path.dirname(payload.backupPath), outDir);
});

test('db backup fails cleanly when the database does not exist', () => {
  const { tmp, env } = setup();
  const missing = path.join(tmp, 'missing.db');

  const backup = runCli(['db', 'backup', '-d', missing, '-j'], { env });
  assert.equal(backup.status, 1);
  const payload = JSON.parse(backup.stdout);
  assert.match(payload.error, /Database not found/);
  assert.equal(fs.existsSync(missing), false);
});
