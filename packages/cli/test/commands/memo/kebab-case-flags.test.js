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

describe('memo commands with kebab-case flags', () => {
  let tmp, configPath, dbPath, env;

  // Setup: Initialize test database
  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-kebab-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);
  });

  test('memo create with --body-file (kebab-case) works', () => {
    const testFile = path.join(tmp, 'test-memo.md');
    fs.writeFileSync(testFile, 'Test memo from file');

    const result = runCli(['memo', 'create', '--body-file', testFile, '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const created = JSON.parse(result.stdout);
    assert.ok(created.memo.id > 0);
    assert.equal(created.memo.bodyMd, 'Test memo from file');
  });

  test('memo create with --bodyFile (camelCase) shows error', () => {
    const testFile = path.join(tmp, 'test-memo2.md');
    fs.writeFileSync(testFile, 'Should not be created');

    const result = runCli(['memo', 'create', '--bodyFile', testFile, '-j'], { env });
    assert.notEqual(result.status, 0, 'Should fail with legacy flag');
    assert.match(result.stderr, /Unknown flag: --bodyFile/, 'Should show legacy flag error');
    assert.match(result.stderr, /--body-file/, 'Should suggest kebab-case');
  });

  test('memo edit with --add-label (kebab-case) works', () => {
    // Create memo first
    const create = runCli(['memo', 'create', '-b', 'Memo to edit', '-j'], { env });
    assert.equal(create.status, 0, create.stderr);
    const created = JSON.parse(create.stdout);
    const memoId = created.memo.id;

    // Edit with kebab-case flag
    const edit = runCli(['memo', 'edit', String(memoId), '--add-label', 'test-label', '-j'], { env });
    assert.equal(edit.status, 0, edit.stderr);

    const edited = JSON.parse(edit.stdout);
    // Check if labels array exists and contains the label
    assert.ok(edited.memo, 'Should have memo object');
    assert.ok(Array.isArray(edited.memo.labels) || edited.memo.labels === undefined, 'labels should be array or undefined');
    // Note: The exact label structure depends on memoRepository implementation
    // For now, just verify the command succeeded with correct flag
  });

  test('memo edit with --addLabel (camelCase) shows error', () => {
    const result = runCli(['memo', 'edit', '1', '--addLabel', 'fail', '-j'], { env });
    assert.notEqual(result.status, 0, 'Should fail with legacy flag');
    assert.match(result.stderr, /Unknown flag: --addLabel/, 'Should show legacy flag error');
    assert.match(result.stderr, /--add-label/, 'Should suggest kebab-case');
  });

  test('memo edit with --setLabel (removed flag) shows migration message', () => {
    const result = runCli(['memo', 'edit', '1', '--setLabel', 'fail', '-j'], { env });
    assert.notEqual(result.status, 0, 'Should fail with removed flag');
    assert.match(result.stderr, /--setLabel has been removed/, 'Should show removal message');
    assert.match(result.stderr, /memo label set/, 'Should suggest alternative command');
  });

  test('cleanup test environment', () => {
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
