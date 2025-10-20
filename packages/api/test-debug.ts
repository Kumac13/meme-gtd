import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureDatabase } from 'meme-gtd-db';
import { MemoService } from 'meme-gtd-core';
import type { MgtdConfig } from 'meme-gtd-config';

// Create temporary database
const tmpDir = mkdtempSync(join(tmpdir(), 'mgtd-debug-'));
const dbPath = join(tmpDir, 'test.db');

const config: MgtdConfig = {
  dbPath,
  mode: 'local',
  schemaVersion: '001_init',
};

console.log('Config:', config);

// Initialize database
try {
  const db = ensureDatabase(config);
  console.log('Database initialized successfully');
  db.close();
} catch (error) {
  console.error('Database initialization failed:', error);
  process.exit(1);
}

// Test MemoService
try {
  const memoService = new MemoService({ config });
  console.log('MemoService created successfully');

  const memo = memoService.create({ bodyMd: 'Test memo' });
  console.log('Memo created:', memo);

  const memos = memoService.list();
  console.log('Memos list:', memos);
} catch (error) {
  console.error('MemoService failed:', error);
  process.exit(1);
}

console.log('All tests passed!');
