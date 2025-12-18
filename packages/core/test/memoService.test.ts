import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { writeConfig, loadConfig } from 'meme-gtd-config';
import { applyMigrations } from 'meme-gtd-db';
import { MemoService } from '../src/index';

const setupConfig = async (dir: string) => {
  const dbPath = path.join(dir, 'issues.db');
  const configPath = path.join(dir, 'context.json');
  applyMigrations(dbPath);
  await writeConfig({
    dbPath,
    mode: 'local',
    schemaVersion: '001_init',
    updatedAt: new Date().toISOString()
  }, configPath);
  return { dbPath, configPath };
};

test('MemoService create and list', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new MemoService({ config });
  const memo = service.create({ bodyMd: 'core memo', labels: ['core'] });
  const result = service.list({ label: 'core' });
  assert.equal(result.data.length, 1);
  assert.equal(result.total, 1);
  assert.equal(result.data[0].id, memo.id);
  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

// ============================================================
// Pagination: MemoService.list tests
// ============================================================

test('MemoService.list returns { data, total } format', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new MemoService({ config });

  // Setup: 5 memos
  for (let i = 0; i < 5; i++) {
    service.create({ bodyMd: `Memo ${i}` });
  }

  const result = service.list({ limit: 2 });
  assert.ok(result.data, 'result.data should exist');
  assert.ok(Array.isArray(result.data), 'result.data should be an array');
  assert.equal(result.data.length, 2);
  assert.equal(result.total, 5);

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('MemoService.list applies offset correctly', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new MemoService({ config });

  // Setup: 5 memos
  for (let i = 0; i < 5; i++) {
    service.create({ bodyMd: `Memo ${i}` });
  }

  const result = service.list({ limit: 2, offset: 2, order: 'asc' });
  assert.equal(result.data.length, 2);
  assert.equal(result.total, 5);
  assert.equal(result.data[0].bodyMd, 'Memo 2');
  assert.equal(result.data[1].bodyMd, 'Memo 3');

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('MemoService.list total ignores limit and offset', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new MemoService({ config });

  // Setup: 10 memos
  for (let i = 0; i < 10; i++) {
    service.create({ bodyMd: `Memo ${i}` });
  }

  const result = service.list({ limit: 3, offset: 5 });
  assert.equal(result.data.length, 3);
  assert.equal(result.total, 10);

  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});

test('MemoService promote', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new MemoService({ config });
  const memo = service.create({ bodyMd: 'promote me' });
  const result = service.promote({ memoId: memo.id, title: 'task title' });
  assert.ok(result.taskId > 0);
  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});
