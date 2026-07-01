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

describe('link command (space-separated syntax)', () => {
  let tmp, configPath, dbPath, env;
  let sourceId, targetId, linkId;

  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-link-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);

    const source = runCli(['task', 'create', '-t', 'Link Source', '--no-editor', '-j'], { env });
    assert.equal(source.status, 0, source.stderr);
    sourceId = JSON.parse(source.stdout).id;

    const target = runCli(['task', 'create', '-t', 'Link Target', '--no-editor', '-j'], { env });
    assert.equal(target.status, 0, target.stderr);
    targetId = JSON.parse(target.stdout).id;
  });

  test('link add works with space-separated syntax', () => {
    const result = runCli(
      [
        'link',
        'add',
        '--type',
        'relates',
        '--source',
        String(sourceId),
        '--target',
        String(targetId),
        '-j'
      ],
      { env }
    );
    assert.equal(result.status, 0, result.stderr);

    const link = JSON.parse(result.stdout);
    assert.equal(link.sourceIssueId, sourceId);
    assert.equal(link.targetIssueId, targetId);
    assert.equal(link.linkType, 'relates');
    linkId = link.id;
  });

  test('link list works with space-separated syntax', () => {
    const result = runCli(['link', 'list', String(sourceId), '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const links = JSON.parse(result.stdout);
    assert.ok(Array.isArray(links));
    assert.equal(links.length, 1);
    assert.equal(links[0].id, linkId);
  });

  test('link remove works with space-separated syntax', () => {
    const result = runCli(['link', 'remove', String(linkId), '--yes', '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const list = runCli(['link', 'list', String(sourceId), '-j'], { env });
    assert.equal(list.status, 0, list.stderr);
    assert.equal(JSON.parse(list.stdout).length, 0);
  });

  test('cleanup test environment', () => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
