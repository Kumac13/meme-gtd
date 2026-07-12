import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase } from '../src/index';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-mig015-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test('migration 015 adds template_target column and the template type', () => {
  const { dir, db } = createTempDb();
  try {
    const columns = db.prepare('PRAGMA table_info(issues)').all().map((c: any) => c.name);
    assert.ok(columns.includes('template_target'));

    // type CHECK now accepts 'template'; sync trigger survived the rebuild and stamps.
    db.prepare("INSERT INTO issues (type, body_md, template_target) VALUES ('template', '## steps', 'task')").run();
    const row = db.prepare("SELECT template_target, server_seq, uuid FROM issues WHERE type = 'template'").get() as any;
    assert.equal(row.template_target, 'task');
    assert.ok(row.server_seq > 0);
    assert.match(row.uuid, UUID_PATTERN);
  } finally {
    db.close();
    fs.removeSync(dir);
  }
});

test('migration 015 enforces type and template_target CHECK constraints', () => {
  const { dir, db } = createTempDb();
  try {
    assert.throws(
      () => db.prepare("INSERT INTO issues (type, body_md) VALUES ('bogus', 'x')").run(),
      /CHECK/
    );
    assert.throws(
      () => db.prepare("INSERT INTO issues (type, body_md, template_target) VALUES ('template', 'x', 'memo')").run(),
      /CHECK/
    );

    // Existing types remain valid after the rebuild.
    db.prepare("INSERT INTO issues (type, body_md) VALUES ('task', 'ok')").run();
    db.prepare("INSERT INTO issues (type, body_md) VALUES ('memo', 'ok')").run();
    db.prepare("INSERT INTO issues (type, title, body_md, meta) VALUES ('article', 't', 'b', json_object('originalUrl', 'https://x.example'))").run();
  } finally {
    db.close();
    fs.removeSync(dir);
  }
});

test('migration 015 preserves issues indexes and triggers after the table rebuild', () => {
  const { dir, db } = createTempDb();
  try {
    const objects = db
      .prepare("SELECT type || ':' || name AS n FROM sqlite_master WHERE tbl_name = 'issues' AND type IN ('index', 'trigger')")
      .all()
      .map((r: any) => r.n);

    for (const required of [
      'index:idx_issues_server_seq',
      'index:idx_issues_task_kind',
      'index:idx_issues_uuid',
      'trigger:issues_ad',
      'trigger:issues_ai',
      'trigger:issues_au',
      'trigger:issues_sync_ai',
      'trigger:issues_sync_au'
    ]) {
      assert.ok(objects.includes(required), `expected ${required} to survive the rebuild`);
    }

    // FTS insert trigger still fires (row mirrored into issues_fts by issue_id).
    const info = db.prepare("INSERT INTO issues (type, title, body_md) VALUES ('task', 'Findme', 'deploy notes')").run();
    const fts = db.prepare('SELECT count(*) AS c FROM issues_fts WHERE issue_id = ?').get(info.lastInsertRowid) as any;
    assert.equal(fts.c, 1);
  } finally {
    db.close();
    fs.removeSync(dir);
  }
});
