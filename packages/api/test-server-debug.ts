import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureDatabase } from 'meme-gtd-db';
import type { MgtdConfig } from 'meme-gtd-config';
import { buildApp } from './src/server.js';

// Create temporary database
const tmpDir = mkdtempSync(join(tmpdir(), 'mgtd-server-debug-'));
const dbPath = join(tmpDir, 'test.db');

const config: MgtdConfig = {
  dbPath,
  mode: 'local',
  schemaVersion: '001_init',
};

console.log('Initializing database...');
const db = ensureDatabase(config);
db.close();

console.log('Building app...');
const app = await buildApp({
  config,
  corsAllowedOrigins: ['*'],
  logger: {
    level: 'debug',
    prettyPrint: true,
  },
});

console.log('Testing POST /api/memos...');
const response = await app.inject({
  method: 'POST',
  url: '/api/memos',
  payload: { bodyMd: 'Test memo content' },
});

console.log('Response status:', response.statusCode);
console.log('Response body:', response.body);

if (response.statusCode === 500) {
  const error = JSON.parse(response.body);
  console.error('ERROR:', error);
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
}

await app.close();
