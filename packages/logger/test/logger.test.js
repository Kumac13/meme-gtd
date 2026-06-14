import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { buildLogTargets } from '../dist/index.js';

test('buildLogTargets defaults to a single plain stdout target', () => {
  const targets = buildLogTargets();
  assert.equal(targets.length, 1);
  assert.equal(targets[0].target, 'pino/file');
});

test('buildLogTargets uses pino-pretty for stdout when pretty is set', () => {
  const targets = buildLogTargets({ pretty: true });
  assert.equal(targets.length, 1);
  assert.equal(targets[0].target, 'pino-pretty');
});

test('buildLogTargets adds a rotating file target when logFile is set', () => {
  const targets = buildLogTargets({ logFile: '/tmp/mgtd.log' });
  assert.equal(targets.length, 2);
  assert.equal(targets[1].target, 'pino-roll');
  assert.equal(targets[1].options.file, '/tmp/mgtd.log');
});

test('logging with a logFile target writes JSON lines to the file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-logger-test-'));
  const logFile = path.join(dir, 'logs', 'mgtd.log');
  const logDir = path.dirname(logFile);

  const transport = pino.transport({ targets: buildLogTargets({ logFile }) });
  const logger = pino({ name: 'mgtd-test', level: 'info' }, transport);
  logger.info({ marker: 'file-target' }, 'hello log file');

  // The transport worker flushes asynchronously; poll until the entry
  // appears (timers also keep the event loop alive while waiting)
  const readEntry = () => {
    if (!fs.existsSync(logDir)) {
      return undefined;
    }
    const contents = fs
      .readdirSync(logDir)
      .map((file) => fs.readFileSync(path.join(logDir, file), 'utf-8'))
      .join('');
    return contents
      .split('\n')
      .filter(Boolean)
      .map((raw) => JSON.parse(raw))
      .find((entry) => entry.marker === 'file-target');
  };

  let line;
  const deadline = Date.now() + 10_000;
  while (!line && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    line = readEntry();
  }
  transport.end();

  assert.ok(line, 'expected the logged entry in the file');
  assert.equal(line.msg, 'hello log file');
});
