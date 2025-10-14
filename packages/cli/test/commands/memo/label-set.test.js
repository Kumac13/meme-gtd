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

describe('memo label set command (User Story 3)', () => {
  let tmp, configPath, dbPath, env;

  // Setup: Initialize test database
  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-label-set-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);
  });

  test('memo label set replaces all labels', () => {
    // Create a memo with initial labels
    const create = runCli(['memo', 'create', '-b', 'Test memo', '--label', 'inbox', '--label', 'urgent', '-j'], { env });
    assert.equal(create.status, 0, create.stderr);
    const memoId = JSON.parse(create.stdout).memo.id;

    // Replace labels using memo label set
    const setLabels = runCli(['memo', 'label', 'set', String(memoId), '--label', 'done', '--label', 'archived', '-j'], { env });
    assert.equal(setLabels.status, 0, setLabels.stderr);

    const result = JSON.parse(setLabels.stdout);
    assert.ok(result.labels, 'Should have labels in response');
    assert.ok(Array.isArray(result.labels), 'Labels should be an array');

    // Verify old labels are removed and new labels are set
    const labelNames = result.labels.map(l => l.name || l);
    assert.ok(labelNames.includes('done'), 'Should include new label "done"');
    assert.ok(labelNames.includes('archived'), 'Should include new label "archived"');
    assert.ok(!labelNames.includes('inbox'), 'Should not include old label "inbox"');
    assert.ok(!labelNames.includes('urgent'), 'Should not include old label "urgent"');
  });

  test('memo label set with single label', () => {
    // Create a memo with multiple labels
    const create = runCli(['memo', 'create', '-b', 'Another memo', '--label', 'a', '--label', 'b', '--label', 'c', '-j'], { env });
    assert.equal(create.status, 0, create.stderr);
    const memoId = JSON.parse(create.stdout).memo.id;

    // Set single label
    const setLabels = runCli(['memo', 'label', 'set', String(memoId), '--label', 'single', '-j'], { env });
    assert.equal(setLabels.status, 0, setLabels.stderr);

    const result = JSON.parse(setLabels.stdout);
    const labelNames = result.labels.map(l => l.name || l);
    assert.equal(labelNames.length, 1, 'Should have exactly one label');
    assert.equal(labelNames[0], 'single', 'Should have the single label');
  });

  test('memo label set requires --label flag', () => {
    // Create a memo
    const create = runCli(['memo', 'create', '-b', 'Test', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;

    // Try to set labels without --label flag
    const result = runCli(['memo', 'label', 'set', String(memoId), '-j'], { env });
    assert.notEqual(result.status, 0, 'Should fail without --label flag');
    assert.match(result.stderr, /required/i, 'Should show required flag error');
  });

  test('memo edit --setLabel is removed and suggests memo label set', () => {
    // This test verifies User Story 3 requirement
    const create = runCli(['memo', 'create', '-b', 'Test', '-j'], { env });
    const memoId = JSON.parse(create.stdout).memo.id;

    // Try to use old --setLabel flag
    const result = runCli(['memo', 'edit', String(memoId), '--setLabel', 'new', '-j'], { env });
    assert.notEqual(result.status, 0, 'Should fail with removed flag');
    assert.match(result.stderr, /--setLabel has been removed/, 'Should show removal message');
    assert.match(result.stderr, /memo label set/, 'Should suggest memo label set command');
  });

  test('cleanup test environment', () => {
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
