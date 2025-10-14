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

describe('memo bookmark command (User Story 1)', () => {
  let tmp, configPath, dbPath, env;

  // Setup: Initialize test database
  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-bookmark-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);
  });

  // T008: Integration test for memo bookmark command
  test('memo bookmark happy path', () => {
    // Create a memo
    const create = runCli(['memo', 'create', '-b', 'Test memo for bookmark', '-j'], { env });
    assert.equal(create.status, 0, create.stderr);
    const memoId = JSON.parse(create.stdout).memo.id;

    // Bookmark the memo
    const bookmark = runCli(['memo:bookmark', String(memoId)], { env });
    assert.equal(bookmark.status, 0, bookmark.stderr);
    assert.match(bookmark.stdout, /Bookmarked memo #\d+/, 'Should show success message');
  });

  test('memo bookmark idempotency', () => {
    // Create a memo
    const create = runCli(['memo', 'create', '-b', 'Idempotency test', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;

    // Bookmark twice
    const bookmark1 = runCli(['memo:bookmark', String(memoId)], { env });
    assert.equal(bookmark1.status, 0, 'First bookmark should succeed');

    const bookmark2 = runCli(['memo:bookmark', String(memoId)], { env });
    assert.equal(bookmark2.status, 0, 'Second bookmark should succeed (idempotent)');
  });

  test('memo bookmark JSON output', () => {
    // Create a memo
    const create = runCli(['memo', 'create', '-b', 'JSON test', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;

    // Bookmark with JSON flag
    const bookmark = runCli(['memo:bookmark', String(memoId), '--json'], { env });
    assert.equal(bookmark.status, 0, bookmark.stderr);

    const result = JSON.parse(bookmark.stdout);
    assert.equal(result.id, memoId, 'Should return correct ID');
    assert.equal(result.isBookmarked, true, 'Should return isBookmarked: true');
  });

  test('memo bookmark error: non-existent ID', () => {
    // Try to bookmark non-existent memo
    const result = runCli(['memo:bookmark', '99999'], { env });
    assert.notEqual(result.status, 0, 'Should fail with non-existent ID');
    assert.match(result.stderr, /not found/i, 'Should show not found error');
  });

  // T009: Integration test for memo unbookmark command
  test('memo unbookmark happy path', () => {
    // Create and bookmark a memo
    const create = runCli(['memo', 'create', '-b', 'Unbookmark test', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;
    runCli(['memo:bookmark', String(memoId)], { env });

    // Unbookmark the memo
    const unbookmark = runCli(['memo:unbookmark', String(memoId)], { env });
    assert.equal(unbookmark.status, 0, unbookmark.stderr);
    assert.match(unbookmark.stdout, /Removed bookmark from memo #\d+/, 'Should show success message');
  });

  test('memo unbookmark idempotency', () => {
    // Create a memo (not bookmarked)
    const create = runCli(['memo', 'create', '-b', 'Unbookmark idempotency', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;

    // Unbookmark twice (even though not bookmarked)
    const unbookmark1 = runCli(['memo:unbookmark', String(memoId)], { env });
    assert.equal(unbookmark1.status, 0, 'First unbookmark should succeed');

    const unbookmark2 = runCli(['memo:unbookmark', String(memoId)], { env });
    assert.equal(unbookmark2.status, 0, 'Second unbookmark should succeed (idempotent)');
  });

  test('memo unbookmark JSON output', () => {
    // Create and bookmark a memo
    const create = runCli(['memo', 'create', '-b', 'JSON unbookmark', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;
    runCli(['memo:bookmark', String(memoId)], { env });

    // Unbookmark with JSON flag
    const unbookmark = runCli(['memo:unbookmark', String(memoId), '--json'], { env });
    assert.equal(unbookmark.status, 0, unbookmark.stderr);

    const result = JSON.parse(unbookmark.stdout);
    assert.equal(result.id, memoId, 'Should return correct ID');
    assert.equal(result.isBookmarked, false, 'Should return isBookmarked: false');
  });

  // T010: Integration test for memo list --bookmarked filter
  test('memo list --bookmarked filter', () => {
    // Create bookmarked and non-bookmarked memos
    const create1 = runCli(['memo', 'create', '-b', 'Bookmarked memo 1', '-j'], { env });
    const id1 = JSON.parse(create1.stdout).memo.id;
    runCli(['memo:bookmark', String(id1)], { env });

    const create2 = runCli(['memo', 'create', '-b', 'Non-bookmarked memo', '-j'], { env });
    JSON.parse(create2.stdout).memo.id; // Not bookmarked

    const create3 = runCli(['memo', 'create', '-b', 'Bookmarked memo 2', '-j'], { env });
    const id3 = JSON.parse(create3.stdout).memo.id;
    runCli(['memo:bookmark', String(id3)], { env });

    // List only bookmarked memos
    const list = runCli(['memo', 'list', '--bookmarked', '--json'], { env });
    assert.equal(list.status, 0, list.stderr);

    const result = JSON.parse(list.stdout);
    const memos = result.memos;
    assert.ok(Array.isArray(memos), 'Should return array');

    // All returned memos should be bookmarked
    for (const memo of memos) {
      assert.equal(memo.isBookmarked, true, 'All memos should be bookmarked');
    }

    // Should contain our bookmarked memos
    const ids = memos.map(m => m.id);
    assert.ok(ids.includes(id1), 'Should include first bookmarked memo');
    assert.ok(ids.includes(id3), 'Should include second bookmarked memo');
  });

  test('memo list --bookmarked with label filter (AND logic)', () => {
    // Create bookmarked memos with different labels
    const create1 = runCli(['memo', 'create', '-b', 'Urgent bookmarked', '--label', 'urgent', '-j'], { env });
    const id1 = JSON.parse(create1.stdout).memo.id;
    runCli(['memo:bookmark', String(id1)], { env });

    const create2 = runCli(['memo', 'create', '-b', 'Bookmarked no label', '-j'], { env });
    const id2 = JSON.parse(create2.stdout).memo.id;
    runCli(['memo:bookmark', String(id2)], { env });

    const create3 = runCli(['memo', 'create', '-b', 'Urgent not bookmarked', '--label', 'urgent', '-j'], { env });
    JSON.parse(create3.stdout).memo.id; // Not bookmarked

    // Filter: bookmarked AND label=urgent
    const list = runCli(['memo', 'list', '--bookmarked', '--label', 'urgent', '--json'], { env });
    assert.equal(list.status, 0, list.stderr);

    const result = JSON.parse(list.stdout);
    const memos = result.memos;

    // Should only have memos that are both bookmarked AND have urgent label
    assert.ok(memos.length >= 1, 'Should have at least one result');
    for (const memo of memos) {
      assert.equal(memo.isBookmarked, true, 'Should be bookmarked');
    }

    const ids = memos.map(m => m.id);
    assert.ok(ids.includes(id1), 'Should include bookmarked memo with urgent label');
  });

  test('cleanup test environment', () => {
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
