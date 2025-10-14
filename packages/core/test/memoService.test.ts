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
  const list = service.list({ label: 'core' });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, memo.id);
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
