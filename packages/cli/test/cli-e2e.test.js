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

  const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
  assert.equal(init.status, 0, init.stderr);
  const initPayload = JSON.parse(init.stdout);
  assert.equal(initPayload.dbPath, path.resolve(dbPath));

  const create = runCli(['memo', 'create', '-b', 'e2e memo', '-l', 'test', '-j'], { env });
  assert.equal(create.status, 0, create.stderr);
  const created = JSON.parse(create.stdout);
  assert.ok(created.memo.id > 0);

  const positional = runCli(['memo', 'create', 'positional memo', '-l', 'pos', '-j'], { env });
  assert.equal(positional.status, 0, positional.stderr);
  const createdPositional = JSON.parse(positional.stdout);
  assert.ok(createdPositional.memo.id > created.memo.id);

  const list = runCli(['memo', 'list', '-j'], { env });
  assert.equal(list.status, 0, list.stderr);
  const memos = JSON.parse(list.stdout);
  const bodies = memos.data.map((memo) => memo.bodyMd);
  assert.ok(bodies.includes('e2e memo'));
  assert.ok(bodies.includes('positional memo'));

  const completion = runCli(['completion', '-s', 'bash'], { env });
  assert.equal(completion.status, 0, completion.stderr);
  assert.match(completion.stdout, /_mgtd_complete_full/);
});
