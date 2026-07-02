import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import Database from 'better-sqlite3';
import { applyMigrations, openDatabase } from '../src/index';
import {
  createMemo,
  updateMemo,
  deleteMemo,
  setBookmark,
  addComment,
  updateComment,
  deleteComment
} from '../src/memoRepository';
import { createTask } from '../src/taskRepository';
import { createArticle } from '../src/articleRepository';
import { createLabel, attachLabelToIssue, detachLabelFromIssue, deleteLabel } from '../src/labelRepository';

const schemaDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/schema');

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-synctest-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

const currentSeq = (db: Database.Database): number =>
  (db.prepare('SELECT seq FROM sync_sequence WHERE id = 1').get() as { seq: number }).seq;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test('migration 014 creates sync tables and columns', () => {
  const { dir, db } = createTempDb();

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('sync_sequence', 'sync_tombstones', 'sync_applied_ops')")
    .all()
    .map((row: any) => row.name)
    .sort();
  assert.deepEqual(tables, ['sync_applied_ops', 'sync_sequence', 'sync_tombstones']);

  const issueColumns = db.prepare('PRAGMA table_info(issues)').all().map((c: any) => c.name);
  assert.ok(issueColumns.includes('uuid'));
  assert.ok(issueColumns.includes('server_seq'));

  const commentColumns = db.prepare('PRAGMA table_info(comments)').all().map((c: any) => c.name);
  assert.ok(commentColumns.includes('uuid'));
  assert.ok(commentColumns.includes('server_seq'));

  const labelColumns = db.prepare('PRAGMA table_info(labels)').all().map((c: any) => c.name);
  assert.ok(labelColumns.includes('server_seq'));

  const issueLabelColumns = db.prepare('PRAGMA table_info(issue_labels)').all().map((c: any) => c.name);
  assert.ok(issueLabelColumns.includes('server_seq'));

  assert.equal(currentSeq(db), 0);

  db.close();
  fs.removeSync(dir);
});

test('createMemo stamps uuid (v7 from repository) and server_seq', () => {
  const { dir, db } = createTempDb();

  const memo1 = createMemo(db, { bodyMd: 'first' });
  const memo2 = createMemo(db, { bodyMd: 'second' });

  assert.ok(memo1.uuid && UUID_PATTERN.test(memo1.uuid));
  assert.ok(memo2.uuid && UUID_PATTERN.test(memo2.uuid));
  assert.notEqual(memo1.uuid, memo2.uuid);
  // repository generates UUIDv7 (version nibble = 7)
  assert.equal(memo1.uuid![14], '7');

  assert.equal(memo1.serverSeq, 1);
  assert.equal(memo2.serverSeq, 2);
  assert.equal(currentSeq(db), 2);

  db.close();
  fs.removeSync(dir);
});

test('update / bookmark / soft-delete each bump server_seq', () => {
  const { dir, db } = createTempDb();

  const memo = createMemo(db, { bodyMd: 'original' });
  const seqAfterCreate = currentSeq(db);

  const updated = updateMemo(db, { id: memo.id, bodyMd: 'edited' });
  assert.equal(updated.serverSeq, seqAfterCreate + 1);

  setBookmark(db, memo.id, true);
  const afterBookmark = db
    .prepare('SELECT server_seq FROM issues WHERE id = @id')
    .get({ id: memo.id }) as { server_seq: number };
  assert.equal(afterBookmark.server_seq, seqAfterCreate + 2);

  deleteMemo(db, memo.id);
  const afterDelete = db
    .prepare('SELECT server_seq, is_deleted FROM issues WHERE id = @id')
    .get({ id: memo.id }) as { server_seq: number; is_deleted: number };
  assert.equal(afterDelete.is_deleted, 1);
  assert.equal(afterDelete.server_seq, seqAfterCreate + 3);

  db.close();
  fs.removeSync(dir);
});

test('comments get uuid and server_seq, updates bump the sequence', () => {
  const { dir, db } = createTempDb();

  const memo = createMemo(db, { bodyMd: 'memo' });
  const comment = addComment(db, memo.id, 'a comment');

  assert.ok(comment.uuid && UUID_PATTERN.test(comment.uuid));
  assert.ok(comment.serverSeq! > memo.serverSeq!);

  const updated = updateComment(db, comment.id, 'edited comment');
  assert.equal(updated.uuid, comment.uuid);
  assert.ok(updated.serverSeq! > comment.serverSeq!);

  const seqBeforeDelete = currentSeq(db);
  deleteComment(db, comment.id);
  assert.equal(currentSeq(db), seqBeforeDelete + 1);

  db.close();
  fs.removeSync(dir);
});

test('CLI write path (repository direct call) is stamped too', () => {
  // The CLI writes through packages/core -> these same repository functions,
  // bypassing the API entirely. Stamping happens in SQLite triggers, so any
  // repository-level write must be sequenced.
  const { dir, db } = createTempDb();

  const task = createTask(db, { title: 'task via cli path', bodyMd: 'body' });
  assert.ok(task.uuid && UUID_PATTERN.test(task.uuid));
  assert.ok(task.serverSeq! >= 1);

  const article = createArticle(db, {
    title: 'article via cli path',
    bodyMd: 'content',
    originalUrl: 'https://example.com/post'
  });
  assert.ok(article.uuid && UUID_PATTERN.test(article.uuid));
  assert.ok(article.serverSeq! > task.serverSeq!);

  db.close();
  fs.removeSync(dir);
});

test('raw INSERT without uuid falls back to trigger-generated uuid', () => {
  const { dir, db } = createTempDb();

  const result = db
    .prepare(
      `INSERT INTO issues (type, title, body_md, created_at, updated_at)
       VALUES ('memo', NULL, 'raw insert', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`
    )
    .run();
  const row = db
    .prepare('SELECT uuid, server_seq FROM issues WHERE id = @id')
    .get({ id: result.lastInsertRowid }) as { uuid: string; server_seq: number };

  assert.ok(UUID_PATTERN.test(row.uuid));
  assert.equal(row.server_seq, 1);

  db.close();
  fs.removeSync(dir);
});

test('labels and issue_labels are sequenced; hard deletes write tombstones', () => {
  const { dir, db } = createTempDb();

  const memo = createMemo(db, { bodyMd: 'memo' });
  const label = createLabel(db, 'work');
  assert.ok(label.serverSeq! > memo.serverSeq!);

  attachLabelToIssue(db, memo.id, label.id);
  const assignment = db
    .prepare('SELECT server_seq FROM issue_labels WHERE issue_id = @issueId AND label_id = @labelId')
    .get({ issueId: memo.id, labelId: label.id }) as { server_seq: number };
  assert.ok(assignment.server_seq > label.serverSeq!);

  // direct detach: label still exists, so labelName resolves in the tombstone
  detachLabelFromIssue(db, memo.id, label.id);
  const detachTombstone = db
    .prepare("SELECT entity, entity_key, server_seq FROM sync_tombstones WHERE entity = 'issue_label'")
    .get() as { entity: string; entity_key: string; server_seq: number };
  const detachKey = JSON.parse(detachTombstone.entity_key);
  assert.equal(detachKey.issueId, memo.id);
  assert.equal(detachKey.labelId, label.id);
  assert.equal(detachKey.labelName, 'work');
  assert.equal(detachKey.issueUuid, memo.uuid);

  // re-attach, then hard-delete the label: cascade must tombstone both entities
  attachLabelToIssue(db, memo.id, label.id);
  const seqBeforeDelete = currentSeq(db);
  deleteLabel(db, 'work');

  const labelTombstone = db
    .prepare("SELECT entity_key FROM sync_tombstones WHERE entity = 'label'")
    .get() as { entity_key: string };
  const labelKey = JSON.parse(labelTombstone.entity_key);
  assert.equal(labelKey.labelId, label.id);
  assert.equal(labelKey.labelName, 'work');

  const cascadeTombstones = db
    .prepare("SELECT entity_key FROM sync_tombstones WHERE entity = 'issue_label' ORDER BY id DESC LIMIT 1")
    .get() as { entity_key: string };
  const cascadeKey = JSON.parse(cascadeTombstones.entity_key);
  assert.equal(cascadeKey.issueId, memo.id);
  assert.equal(cascadeKey.labelId, label.id);

  assert.ok(currentSeq(db) > seqBeforeDelete);

  db.close();
  fs.removeSync(dir);
});

test('existing FTS and activity_log triggers still work after 014', () => {
  const { dir, db } = createTempDb();

  const memo = createMemo(db, { bodyMd: 'searchable haystack' });
  updateMemo(db, { id: memo.id, bodyMd: 'updated needle content' });

  const ftsHits = db
    .prepare("SELECT issue_id FROM issues_fts WHERE issues_fts MATCH 'needle'")
    .all() as Array<{ issue_id: number }>;
  assert.equal(ftsHits.length, 1);
  assert.equal(ftsHits[0].issue_id, memo.id);

  db.prepare(
    `INSERT INTO activity_log (event_type, source_type, payload)
     VALUES ('issue.created', 'system', json_object('issue_id', @id))`
  ).run({ id: memo.id });
  assert.throws(
    () => db.prepare("UPDATE activity_log SET event_type = 'tampered'").run(),
    /append-only/
  );

  db.close();
  fs.removeSync(dir);
});

test('backfill assigns unique uuid and server_seq to pre-existing rows', () => {
  // Simulate a production DB that is on 013: apply 001..013 (each SQL file
  // self-records into schema_migrations), insert data, then run applyMigrations
  // so that only 014 executes.
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-backfill-'));
  const dbPath = path.join(dir, 'issues.db');

  const preMigrations = [
    '001_init.sql',
    '002_add_project_view_meta.sql',
    '003_add_fts5.sql',
    '004_add_task_time_fields.sql',
    '005_add_task_end_date.sql',
    '006_add_project_status_and_schedule.sql',
    '007_add_calendar_datetime_fields.sql',
    '008_add_activity_log.sql',
    '009_activity_log_immutability.sql',
    '010_update_issues_type_check.sql',
    '011_add_url_links.sql',
    '012_add_task_kind.sql',
    '013_add_embeddings.sql'
  ];

  const raw = new Database(dbPath);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');
  for (const file of preMigrations) {
    raw.exec(fs.readFileSync(path.join(schemaDir, file), 'utf-8'));
  }

  raw.prepare("INSERT INTO issues (type, body_md) VALUES ('memo', 'legacy memo 1')").run();
  raw.prepare("INSERT INTO issues (type, body_md) VALUES ('memo', 'legacy memo 2')").run();
  raw.prepare("INSERT INTO comments (issue_id, body_md) VALUES (1, 'legacy comment')").run();
  raw.prepare("INSERT INTO labels (name) VALUES ('legacy-label')").run();
  raw.prepare('INSERT INTO issue_labels (issue_id, label_id) VALUES (1, 1)').run();
  raw.close();

  const result = applyMigrations(dbPath);
  // 005/007/012 do not self-record into schema_migrations, so the runner
  // re-applies them harmlessly (duplicate-column errors are swallowed).
  // What matters here is that 014 runs against the pre-existing data.
  assert.ok(result.applied.includes('014_add_sync_support'));

  const db = openDatabase({ dbPath });

  const issueRows = db.prepare('SELECT uuid, server_seq FROM issues ORDER BY id').all() as Array<{
    uuid: string;
    server_seq: number;
  }>;
  assert.equal(issueRows.length, 2);
  for (const row of issueRows) {
    assert.ok(UUID_PATTERN.test(row.uuid));
    assert.ok(row.server_seq >= 1);
  }
  assert.notEqual(issueRows[0].uuid, issueRows[1].uuid);

  const commentRow = db.prepare('SELECT uuid, server_seq FROM comments').get() as {
    uuid: string;
    server_seq: number;
  };
  assert.ok(UUID_PATTERN.test(commentRow.uuid));

  // server_seq is unique across every synced table
  const allSeqs = db
    .prepare(
      `SELECT server_seq FROM issues
       UNION ALL SELECT server_seq FROM comments
       UNION ALL SELECT server_seq FROM labels
       UNION ALL SELECT server_seq FROM issue_labels`
    )
    .all()
    .map((row: any) => row.server_seq);
  assert.equal(new Set(allSeqs).size, allSeqs.length);

  // counter resumes past the backfilled maximum
  const maxSeq = Math.max(...allSeqs);
  assert.equal(currentSeq(db), maxSeq);

  const memo = createMemo(db, { bodyMd: 'post-migration memo' });
  assert.equal(memo.serverSeq, maxSeq + 1);

  db.close();
  fs.removeSync(dir);
});
