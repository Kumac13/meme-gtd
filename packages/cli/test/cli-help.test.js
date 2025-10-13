import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test } from 'node:test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const cliEntry = path.join(projectRoot, 'dist', 'index.js');

const runCli = (args) => {
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    encoding: 'utf8'
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
    signal: result.signal
  };
};

test('mgtd --help がルートコマンドを表示する', () => {
  const { stdout, status, stderr } = runCli(['--help']);
  assert.equal(status, 0, stderr);
  assert.match(stdout, /USAGE/);
  assert.match(stdout, /init/);
  assert.match(stdout, /memo/);
  assert.match(stdout, /completion/);
});

test('mgtd memo comment --help が整形出力になる', () => {
  const { stdout, status, stderr } = runCli(['memo', 'comment', '--help']);
  assert.equal(status, 0, stderr);
  assert.match(stdout, /Inspect memo comments/);
  assert.match(stdout, /USAGE/);
  assert.match(stdout, /memo:comment add/);
});

test('mgtd memo view --help でフラグ情報が出る', () => {
  const { stdout, status, stderr } = runCli(['memo', 'view', '--help']);
  assert.equal(status, 0, stderr);
  assert.match(stdout, /--comments/);
  assert.match(stdout, /--json/);
});
