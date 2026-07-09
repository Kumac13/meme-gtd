import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase } from '../src/index';
import { createArticle } from '../src/articleRepository';
import { updateComment, deleteComment } from '../src/memoRepository';
import {
  createHighlight,
  getHighlight,
  listHighlights,
  deleteHighlight,
  addHighlightComment,
  listHighlightComments,
} from '../src/highlightRepository';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-hltest-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db };
};

const seedArticle = (db: ReturnType<typeof openDatabase>) =>
  createArticle(db, { title: 'A', bodyMd: 'The quick brown fox.', originalUrl: 'https://e.com' });

test('create highlight stamps sync identity and defaults color to green', () => {
  const { dir, db } = createTempDb();
  const article = seedArticle(db);

  const h = createHighlight(db, { issueId: article.id, exact: 'quick brown fox', prefix: 'The ', suffix: '.' });
  assert.equal(h.issueId, article.id);
  assert.equal(h.exact, 'quick brown fox');
  assert.equal(h.prefix, 'The ');
  assert.equal(h.color, 'green');
  assert.equal(h.isDeleted, false);
  assert.equal(h.commentCount, 0);
  // Sync stamping from migration 015 triggers
  assert.ok(h.uuid, 'uuid should be stamped by trigger');
  assert.ok(typeof h.serverSeq === 'number' && h.serverSeq > 0, 'server_seq should be stamped');

  db.close();
  fs.removeSync(dir);
});

test('list highlights returns only non-deleted, ordered by created_at asc', () => {
  const { dir, db } = createTempDb();
  const article = seedArticle(db);
  const first = createHighlight(db, { issueId: article.id, exact: 'quick' });
  createHighlight(db, { issueId: article.id, exact: 'fox' });

  let list = listHighlights(db, article.id);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, first.id);

  deleteHighlight(db, first.id);
  list = listHighlights(db, article.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].exact, 'fox');

  db.close();
  fs.removeSync(dir);
});

test('highlight comments carry highlightId and update commentCount', () => {
  const { dir, db } = createTempDb();
  const article = seedArticle(db);
  const h = createHighlight(db, { issueId: article.id, exact: 'quick' });

  const c1 = addHighlightComment(db, article.id, h.id, 'first note');
  addHighlightComment(db, article.id, h.id, 'second note');
  assert.equal(c1.issueId, article.id);
  assert.equal(c1.highlightId, h.id);

  const comments = listHighlightComments(db, h.id);
  assert.equal(comments.length, 2);
  assert.equal(getHighlight(db, h.id).commentCount, 2);

  // Reuse memoRepository updateComment/deleteComment (commentId-only) on highlight comments
  updateComment(db, c1.id, 'first edited');
  assert.equal(listHighlightComments(db, h.id).find((c) => c.id === c1.id)?.bodyMd, 'first edited');

  deleteComment(db, c1.id);
  assert.equal(listHighlightComments(db, h.id).length, 1);
  assert.equal(getHighlight(db, h.id).commentCount, 1);

  db.close();
  fs.removeSync(dir);
});

test('getHighlight throws for missing/deleted highlight', () => {
  const { dir, db } = createTempDb();
  const article = seedArticle(db);
  const h = createHighlight(db, { issueId: article.id, exact: 'quick' });
  deleteHighlight(db, h.id);
  assert.throws(() => getHighlight(db, h.id), /not found/);
  assert.throws(() => deleteHighlight(db, h.id), /not found/);

  db.close();
  fs.removeSync(dir);
});
