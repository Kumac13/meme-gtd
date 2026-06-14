import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PRODUCTION_DATA_DIR,
  isProductionDbPath,
  loadConfig
} from '../src/index.js';

const tmpDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-config-test-'));

test('isProductionDbPath returns true for paths inside the production data dir', () => {
  assert.equal(isProductionDbPath(path.join(PRODUCTION_DATA_DIR, 'issues.db')), true);
  assert.equal(isProductionDbPath(PRODUCTION_DATA_DIR), true);
  assert.equal(isProductionDbPath(path.join(PRODUCTION_DATA_DIR, 'nested', 'other.db')), true);
});

test('isProductionDbPath returns false for paths outside the production data dir', () => {
  assert.equal(isProductionDbPath('/tmp/mgtd/test.db'), false);
  assert.equal(isProductionDbPath(path.join(os.homedir(), '.local', 'share', 'mgtd-other', 'issues.db')), false);
  assert.equal(isProductionDbPath('./test-data/test.db'), false);
});

test('loadConfig rejects production dbPath when MGTD_ENV=test (config file present)', async () => {
  const dir = tmpDir();
  const configPath = path.join(dir, 'context.json');
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      dbPath: path.join(PRODUCTION_DATA_DIR, 'issues.db'),
      mode: 'local',
      schemaVersion: '001_init'
    })
  );

  await assert.rejects(
    loadConfig({ configPath, env: { MGTD_ENV: 'test' } }),
    /Refusing to continue/
  );
});

test('loadConfig rejects when MGTD_ENV=test and missing config falls back to production default', async () => {
  const dir = tmpDir();
  const configPath = path.join(dir, 'missing-context.json');

  await assert.rejects(
    loadConfig({ configPath, env: { MGTD_ENV: 'test' } }),
    /Refusing to continue/
  );
});

test('loadConfig rejects when MGTD_ENV=test and DB_PATH points at production', async () => {
  const dir = tmpDir();
  const configPath = path.join(dir, 'missing-context.json');

  await assert.rejects(
    loadConfig({
      configPath,
      env: { MGTD_ENV: 'test', DB_PATH: path.join(PRODUCTION_DATA_DIR, 'issues.db') }
    }),
    /Refusing to continue/
  );
});

test('loadConfig allows test dbPath when MGTD_ENV=test', async () => {
  const dir = tmpDir();
  const configPath = path.join(dir, 'missing-context.json');
  const dbPath = path.join(dir, 'test.db');

  const { config } = await loadConfig({
    configPath,
    env: { MGTD_ENV: 'test', DB_PATH: dbPath }
  });
  assert.equal(config.dbPath, dbPath);
});

test('loadConfig honors DB_PATH even when the config file is missing', async () => {
  const dir = tmpDir();
  const configPath = path.join(dir, 'missing-context.json');
  const dbPath = path.join(dir, 'override.db');

  const { config } = await loadConfig({ configPath, env: { DB_PATH: dbPath } });
  assert.equal(config.dbPath, dbPath);
});

test('loadConfig with createIfMissing persists the DB_PATH override', async () => {
  const dir = tmpDir();
  const configPath = path.join(dir, 'context.json');
  const dbPath = path.join(dir, 'override.db');

  await loadConfig({ configPath, env: { DB_PATH: dbPath }, createIfMissing: true });
  const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  assert.equal(written.dbPath, dbPath);
});

test('loadConfig without MGTD_ENV keeps default behavior (production path allowed)', async () => {
  const dir = tmpDir();
  const configPath = path.join(dir, 'missing-context.json');

  const { config } = await loadConfig({ configPath, env: {} });
  assert.equal(config.dbPath, path.join(PRODUCTION_DATA_DIR, 'issues.db'));
});
