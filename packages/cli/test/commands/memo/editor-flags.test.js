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
    env: options.env ?? process.env,
    timeout: options.timeout ?? 5000
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status
  };
};

describe('memo commands with --editor / --no-editor flags', () => {
  let tmp, configPath, dbPath, env;

  // Setup: Initialize test database
  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-editor-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath,
      EDITOR: 'true' // Use 'true' command as a no-op editor for testing
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);
  });

  // memo create tests
  test('memo create with --no-editor and --body should not launch editor', () => {
    const result = runCli(['memo', 'create', '--body', 'Test memo', '--no-editor', '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const created = JSON.parse(result.stdout);
    assert.ok(created.memo.id > 0);
    assert.equal(created.memo.bodyMd, 'Test memo');
  });

  test('memo create with --editor and --body should launch editor with initial content', () => {
    // Since we can't actually interact with the editor in CI, we use 'true' as EDITOR
    // which will just exit successfully. The body should still be created.
    const result = runCli(['memo', 'create', '--body', 'Initial', '--editor', '-j'], { env });

    // With EDITOR=true, the editor exits successfully but doesn't modify the file
    // So we just verify the command doesn't hang and completes
    assert.equal(result.status, 0, result.stderr);

    const created = JSON.parse(result.stdout);
    assert.ok(created.memo.id > 0);
  });

  test('memo create with both --editor and --no-editor should fail', () => {
    const result = runCli(['memo', 'create', '--body', 'Test', '--editor', '--no-editor', '-j'], { env });
    assert.notEqual(result.status, 0, 'Should fail with both flags');
    assert.match(result.stderr, /--editor.*cannot also be provided when using --no-editor|--no-editor.*cannot also be provided when using --editor/, 'Should show mutual exclusivity error');
  });

  test('memo create with --no-editor but no body should fail', () => {
    const result = runCli(['memo', 'create', '--no-editor', '-j'], { env });
    assert.notEqual(result.status, 0, 'Should fail without body');
    assert.match(result.stderr, /Memo body cannot be empty/, 'Should show empty body error');
  });

  // memo edit tests
  test('memo edit with --no-editor and --body should not launch editor', () => {
    // Create a memo first
    const create = runCli(['memo', 'create', '--body', 'Original content', '-j'], { env });
    assert.equal(create.status, 0, create.stderr);
    const memoId = JSON.parse(create.stdout).memo.id;

    // Edit with --no-editor
    const edit = runCli(['memo', 'edit', String(memoId), '--body', 'Updated content', '--no-editor', '-j'], { env });
    assert.equal(edit.status, 0, edit.stderr);

    const edited = JSON.parse(edit.stdout);
    assert.equal(edited.memo.bodyMd, 'Updated content');
  });

  test('memo edit with --editor should launch editor with existing content', () => {
    // Create a memo first
    const create = runCli(['memo', 'create', '--body', 'Original', '-j'], { env });
    assert.equal(create.status, 0, create.stderr);
    const memoId = JSON.parse(create.stdout).memo.id;

    // Edit with --editor (using EDITOR=true)
    const edit = runCli(['memo', 'edit', String(memoId), '--editor', '-j'], { env });
    assert.equal(edit.status, 0, edit.stderr);

    const edited = JSON.parse(edit.stdout);
    assert.ok(edited.memo.id === memoId);
  });

  test('memo edit with both --editor and --no-editor should fail', () => {
    const result = runCli(['memo', 'edit', '1', '--editor', '--no-editor', '-j'], { env });
    assert.notEqual(result.status, 0, 'Should fail with both flags');
    assert.match(result.stderr, /--editor.*cannot also be provided when using --no-editor|--no-editor.*cannot also be provided when using --editor/, 'Should show mutual exclusivity error');
  });

  // memo comment add tests
  test('memo comment add with --no-editor and --body should not launch editor', () => {
    // Create a memo first
    const create = runCli(['memo', 'create', '--body', 'Base memo', '-j'], { env });
    assert.equal(create.status, 0, create.stderr);
    const memoId = JSON.parse(create.stdout).memo.id;

    // Add comment with --no-editor
    const comment = runCli(['memo', 'comment', 'add', String(memoId), '--body', 'Test comment', '--no-editor', '-j'], { env });
    assert.equal(comment.status, 0, comment.stderr);

    const added = JSON.parse(comment.stdout);
    assert.ok(added.comment.id > 0);
    assert.equal(added.comment.bodyMd, 'Test comment');
  });

  test('memo comment add with --editor and --body should launch editor', () => {
    // Create a memo first
    const create = runCli(['memo', 'create', '--body', 'Base memo', '-j'], { env });
    assert.equal(create.status, 0, create.stderr);
    const memoId = JSON.parse(create.stdout).memo.id;

    // Add comment with --editor (using EDITOR=true)
    const comment = runCli(['memo', 'comment', 'add', String(memoId), '--body', 'Initial', '--editor', '-j'], { env });
    assert.equal(comment.status, 0, comment.stderr);

    const added = JSON.parse(comment.stdout);
    assert.ok(added.comment.id > 0);
  });

  test('memo comment add with both --editor and --no-editor should fail', () => {
    const result = runCli(['memo', 'comment', 'add', '1', '--body', 'Test', '--editor', '--no-editor', '-j'], { env });
    assert.notEqual(result.status, 0, 'Should fail with both flags');
    assert.match(result.stderr, /--editor.*cannot also be provided when using --no-editor|--no-editor.*cannot also be provided when using --editor/, 'Should show mutual exclusivity error');
  });

  test('memo comment add with --no-editor but no body should fail', () => {
    const create = runCli(['memo', 'create', '--body', 'Base memo', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;

    const result = runCli(['memo', 'comment', 'add', String(memoId), '--no-editor', '-j'], { env });
    assert.notEqual(result.status, 0, 'Should fail without body');
    assert.match(result.stderr, /Comment body cannot be empty/, 'Should show empty body error');
  });

  test('cleanup test environment', () => {
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
