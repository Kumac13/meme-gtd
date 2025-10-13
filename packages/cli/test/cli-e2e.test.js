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

test('mgtd end-to-end memo lifecycle', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-e2e-'));
  const configPath = path.join(tmp, 'context.json');
  const dbPath = path.join(tmp, 'issues.db');
  const env = {
    ...process.env,
    MGTD_CONFIG_PATH: configPath
  };

  const init = runCli(['init', '--db', dbPath, '--force', '--json'], { env });
  assert.equal(init.status, 0, init.stderr);
  const initPayload = JSON.parse(init.stdout);
  assert.equal(initPayload.dbPath, path.resolve(dbPath));

  const create = runCli(['memo', 'create', '--body', 'e2e memo', '--label', 'test', '--json'], { env });
  assert.equal(create.status, 0, create.stderr);
  const created = JSON.parse(create.stdout);
  assert.ok(created.memo.id > 0);

  const list = runCli(['memo', 'list', '--json'], { env });
  assert.equal(list.status, 0, list.stderr);
  const memos = JSON.parse(list.stdout);
  assert.equal(memos.memos.length, 1);
  assert.equal(memos.memos[0].bodyMd, 'e2e memo');

  const completion = runCli(['completion', '--shell', 'bash'], { env });
  assert.equal(completion.status, 0, completion.stderr);
  assert.match(completion.stdout, /_mgtd_complete_full/);
});
