import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase } from '../src/index';

test('migration 018 drops the issue_embeddings table on a fresh database', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-mig018-'));
  const dbPath = path.join(dir, 'issues.db');
  try {
    const { applied } = applyMigrations(dbPath);
    assert.ok(applied.includes('018_drop_issue_embeddings'));

    const db = openDatabase({ dbPath });
    try {
      const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'issue_embeddings'")
        .get();
      assert.equal(table, undefined);
    } finally {
      db.close();
    }
  } finally {
    fs.removeSync(dir);
  }
});

test('migration 018 drops an issue_embeddings table that contains rows', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-mig018-data-'));
  const dbPath = path.join(dir, 'issues.db');
  try {
    // 013 適用済み・018 未適用のDBを再現し、embedding 行を残した状態から
    // 018 が適用できることを確認する（本番DBと同じ経路）。
    applyMigrations(dbPath);
    const db = openDatabase({ dbPath });
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS issue_embeddings (
            issue_id INTEGER PRIMARY KEY,
            embedding BLOB NOT NULL,
            model TEXT NOT NULL,
            dimensions INTEGER NOT NULL,
            content_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
            FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
        );
      `);
      db.prepare("INSERT INTO issues (type, body_md) VALUES ('memo', 'embedded memo')").run();
      const issue = db.prepare('SELECT id FROM issues LIMIT 1').get() as { id: number };
      db.prepare(
        'INSERT INTO issue_embeddings (issue_id, embedding, model, dimensions, content_hash) VALUES (?, ?, ?, ?, ?)'
      ).run(issue.id, Buffer.from([0, 0, 128, 63]), 'test-model', 1, 'hash');
      db.prepare("DELETE FROM schema_migrations WHERE version = '018_drop_issue_embeddings'").run();
    } finally {
      db.close();
    }

    const { applied } = applyMigrations(dbPath);
    assert.ok(applied.includes('018_drop_issue_embeddings'));

    const verify = openDatabase({ dbPath });
    try {
      const table = verify
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'issue_embeddings'")
        .get();
      assert.equal(table, undefined);
    } finally {
      verify.close();
    }
  } finally {
    fs.removeSync(dir);
  }
});
