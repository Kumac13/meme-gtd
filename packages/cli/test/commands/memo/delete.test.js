import { strict as assert } from 'node:assert';
import { spawn, spawnSync } from 'node:child_process';
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

// Note: Interactive prompt testing requires a pseudo-TTY which is not available
// in Node.js spawn without external dependencies. Interactive tests are covered
// in manual verification (Phase 7 / quickstart.md).
const runNonTtyCommand = (argv, options = {}) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [cliDist, ...argv], {
      env: options.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'] // Explicitly no TTY
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, status: code });
    });

    proc.on('error', (err) => {
      reject(err);
    });

    proc.stdin.end();
  });
};

describe('memo delete command (User Story 1, 2, 3)', () => {
  let tmp, configPath, dbPath, env;

  // Setup: Initialize test database
  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-delete-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);
  });

  // US1: Non-TTY environment requires --yes flag
  test('[US1] non-TTY environment requires --yes flag', async () => {
    const create = runCli(['memo', 'create', '-b', 'Test non-TTY error', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;

    const result = await runNonTtyCommand(['memo', 'delete', String(memoId)], { env });
    assert.equal(result.status, 1, 'Should exit with error code 1');
    assert.match(result.stderr, /Cannot prompt for confirmation/, 'Should show TTY error message');
    assert.match(result.stderr, /Please use --yes flag/, 'Should suggest --yes flag');

    // Verify memo is NOT deleted
    const list = runCli(['memo', 'list', '-j'], { env });
    const memos = JSON.parse(list.stdout).memos;
    const memo = memos.find(m => m.id === memoId);
    assert.ok(memo && !memo.isDeleted, 'Memo should NOT be deleted in non-TTY without --yes');
  });

  // US1: Non-existent memo shows error
  test('[US1] non-existent memo shows error', () => {
    const result = runCli(['memo', 'delete', '99999', '--yes'], { env });
    assert.notEqual(result.status, 0, 'Should fail with non-existent ID');
    assert.match(result.stderr, /not found/i, 'Should show not found error');
  });

  // US2: --yes flag deletes immediately without prompt
  test('[US2] --yes flag deletes immediately without prompt', () => {
    const create = runCli(['memo', 'create', '-b', 'Test --yes flag', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;

    const result = runCli(['memo', 'delete', String(memoId), '--yes'], { env });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Memo #\d+ marked as deleted/, 'Should show deletion confirmation');
    assert.ok(!result.stdout.includes('(y/n)'), 'Should NOT show interactive prompt');

    // Verify memo is deleted
    const list = runCli(['memo', 'list', '-j'], { env });
    const memos = JSON.parse(list.stdout).memos;
    const deletedMemo = memos.find(m => m.id === memoId);
    assert.ok(!deletedMemo || deletedMemo.isDeleted, 'Memo should be deleted');
  });

  // US2: --yes flag works in non-TTY environment
  test('[US2] --yes flag works in non-TTY environment', async () => {
    const create = runCli(['memo', 'create', '-b', 'Test --yes in non-TTY', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;

    const result = await runNonTtyCommand(['memo', 'delete', String(memoId), '--yes'], { env });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Memo #\d+ marked as deleted/, 'Should delete in non-TTY with --yes');

    // Verify memo is deleted
    const list = runCli(['memo', 'list', '-j'], { env });
    const memos = JSON.parse(list.stdout).memos;
    const deletedMemo = memos.find(m => m.id === memoId);
    assert.ok(!deletedMemo || deletedMemo.isDeleted, 'Memo should be deleted');
  });

  // US3: -y short flag works identically to --yes
  test('[US3] -y short flag deletes immediately without prompt', () => {
    const create = runCli(['memo', 'create', '-b', 'Test -y flag', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;

    const result = runCli(['memo', 'delete', String(memoId), '-y'], { env });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Memo #\d+ marked as deleted/, 'Should show deletion confirmation');
    assert.ok(!result.stdout.includes('(y/n)'), 'Should NOT show interactive prompt');

    // Verify memo is deleted
    const list = runCli(['memo', 'list', '-j'], { env });
    const memos = JSON.parse(list.stdout).memos;
    const deletedMemo = memos.find(m => m.id === memoId);
    assert.ok(!deletedMemo || deletedMemo.isDeleted, 'Memo should be deleted');
  });

  // US3: -y flag works in non-TTY environment
  test('[US3] -y flag works in non-TTY environment', async () => {
    const create = runCli(['memo', 'create', '-b', 'Test -y in non-TTY', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;

    const result = await runNonTtyCommand(['memo', 'delete', String(memoId), '-y'], { env });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Memo #\d+ marked as deleted/, 'Should delete in non-TTY with -y');

    // Verify memo is deleted
    const list = runCli(['memo', 'list', '-j'], { env });
    const memos = JSON.parse(list.stdout).memos;
    const deletedMemo = memos.find(m => m.id === memoId);
    assert.ok(!deletedMemo || deletedMemo.isDeleted, 'Memo should be deleted');
  });

  test('cleanup test environment', () => {
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// Note: Interactive prompt tests (y/n input, case sensitivity, preview display,
// invalid input handling, Ctrl+C) require a pseudo-TTY and are covered in
// manual verification (Phase 7). See quickstart.md for manual test scenarios.
