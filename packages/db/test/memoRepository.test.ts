import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase } from '../src/index';
import {
  createMemo,
  listMemos,
  countMemos,
  getPromotePreview,
  addComment,
  deleteComment,
  listComments,
  listMemoLabels,
  deleteMemo,
  setBookmark,
  findMemoByClientUuid,
  findCommentByClientUuid
} from '../src/memoRepository';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-dbtest-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

test('create/list memo with labels', () => {
  const { dir, db } = createTempDb();
  const memo = createMemo(db, { bodyMd: 'hello memo', labels: ['idea'] });
  const memos = listMemos(db, { label: 'idea' });
  assert.equal(memos.length, 1);
  assert.equal(memos[0].id, memo.id);
  assert.deepEqual(listMemoLabels(db, memo.id), ['idea']);
  db.close();
  fs.removeSync(dir);
});

test('promote preview returns memo body and labels', () => {
  const { dir, db } = createTempDb();
  const memo = createMemo(db, { bodyMd: 'draft task', labels: ['idea'] });
  const preview = getPromotePreview(db, memo.id);
  assert.equal(preview.bodyMd, 'draft task');
  assert.deepEqual(preview.labels, ['idea']);
  assert.deepEqual(preview.projectIds, []);
  assert.deepEqual(preview.linkedIssues, []);
  db.close();
  fs.removeSync(dir);
});

test('add comment to memo', () => {
  const { dir, db } = createTempDb();
  const memo = createMemo(db, { bodyMd: 'needs comment' });
  addComment(db, memo.id, 'first comment');
  const comments = listComments(db, memo.id);
  assert.equal(comments.length, 1);
  assert.equal(comments[0].bodyMd, 'first comment');
  db.close();
  fs.removeSync(dir);
});

test('listMemos returns commentCount field', () => {
  const { dir, db } = createTempDb();

  // Test memo with 0 comments
  const memo1 = createMemo(db, { bodyMd: 'memo without comments' });
  let memos = listMemos(db, {});
  assert.equal(memos.length, 1);
  assert.equal(memos[0].commentCount, 0);

  // Test memo with N comments
  const memo2 = createMemo(db, { bodyMd: 'memo with comments' });
  addComment(db, memo2.id, 'comment 1');
  addComment(db, memo2.id, 'comment 2');
  addComment(db, memo2.id, 'comment 3');
  memos = listMemos(db, {});
  const foundMemo2 = memos.find(m => m.id === memo2.id);
  assert.ok(foundMemo2);
  assert.equal(foundMemo2.commentCount, 3);

  // Test memo with mix of active and soft-deleted comments
  const memo3 = createMemo(db, { bodyMd: 'memo with deleted comments' });
  addComment(db, memo3.id, 'active comment 1');
  addComment(db, memo3.id, 'active comment 2');
  const deletedComment = addComment(db, memo3.id, 'to be deleted');
  deleteComment(db, deletedComment.id);
  memos = listMemos(db, {});
  const foundMemo3 = memos.find(m => m.id === memo3.id);
  assert.ok(foundMemo3);
  assert.equal(foundMemo3.commentCount, 2); // Only count active comments

  // Test filtered results include accurate comment counts
  const memo4 = createMemo(db, { bodyMd: 'bookmarked memo' });
  addComment(db, memo4.id, 'comment on bookmarked');
  db.prepare('UPDATE issues SET is_bookmarked = 1 WHERE id = ?').run(memo4.id);
  const bookmarkedMemos = listMemos(db, { isBookmarked: true });
  assert.equal(bookmarkedMemos.length, 1);
  assert.equal(bookmarkedMemos[0].commentCount, 1);

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// Pagination: countMemos tests
// ============================================================

test('countMemos() returns total count without filters', () => {
  const { dir, db } = createTempDb();

  // Create 3 memos
  createMemo(db, { bodyMd: 'Memo 1' });
  createMemo(db, { bodyMd: 'Memo 2' });
  createMemo(db, { bodyMd: 'Memo 3' });

  const count = countMemos(db, {});
  assert.equal(count, 3);

  db.close();
  fs.removeSync(dir);
});

test('countMemos() returns filtered count with label filter', () => {
  const { dir, db } = createTempDb();

  createMemo(db, { bodyMd: 'Idea 1', labels: ['idea'] });
  createMemo(db, { bodyMd: 'Idea 2', labels: ['idea'] });
  createMemo(db, { bodyMd: 'Note 1', labels: ['note'] });

  const ideaCount = countMemos(db, { label: 'idea' });
  assert.equal(ideaCount, 2);

  const noteCount = countMemos(db, { label: 'note' });
  assert.equal(noteCount, 1);

  db.close();
  fs.removeSync(dir);
});

test('countMemos() returns filtered count with search filter', () => {
  const { dir, db } = createTempDb();

  createMemo(db, { bodyMd: 'Meeting notes from Monday' });
  createMemo(db, { bodyMd: 'Meeting notes from Tuesday' });
  createMemo(db, { bodyMd: 'Random thoughts' });

  const meetingCount = countMemos(db, { search: 'Meeting' });
  assert.equal(meetingCount, 2);

  db.close();
  fs.removeSync(dir);
});

test('countMemos() returns filtered count with isBookmarked filter', () => {
  const { dir, db } = createTempDb();

  const memo1 = createMemo(db, { bodyMd: 'Memo 1' });
  createMemo(db, { bodyMd: 'Memo 2' });
  setBookmark(db, memo1.id, true);

  const bookmarkedCount = countMemos(db, { isBookmarked: true });
  assert.equal(bookmarkedCount, 1);

  db.close();
  fs.removeSync(dir);
});

test('countMemos() excludes deleted memos', () => {
  const { dir, db } = createTempDb();

  createMemo(db, { bodyMd: 'Memo 1' });
  const memo2 = createMemo(db, { bodyMd: 'Memo 2' });
  createMemo(db, { bodyMd: 'Memo 3' });

  deleteMemo(db, memo2.id);

  const count = countMemos(db, {});
  assert.equal(count, 2);

  db.close();
  fs.removeSync(dir);
});

test('countMemos() ignores limit parameter', () => {
  const { dir, db } = createTempDb();

  for (let i = 0; i < 5; i++) {
    createMemo(db, { bodyMd: `Memo ${i}` });
  }

  const count = countMemos(db, { limit: 2 });
  assert.equal(count, 5);

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// Pagination: listMemos offset tests
// ============================================================

test('listMemos() returns correct slice with offset', () => {
  const { dir, db } = createTempDb();

  for (let i = 0; i < 10; i++) {
    createMemo(db, { bodyMd: `Memo ${i}` });
  }

  const memos = listMemos(db, { limit: 3, offset: 3, order: 'asc' });
  assert.equal(memos.length, 3);
  assert.equal(memos[0].bodyMd, 'Memo 3');
  assert.equal(memos[1].bodyMd, 'Memo 4');
  assert.equal(memos[2].bodyMd, 'Memo 5');

  db.close();
  fs.removeSync(dir);
});

test('listMemos() with offset beyond results returns empty array', () => {
  const { dir, db } = createTempDb();

  createMemo(db, { bodyMd: 'Memo 1' });
  createMemo(db, { bodyMd: 'Memo 2' });

  const memos = listMemos(db, { limit: 10, offset: 100 });
  assert.equal(memos.length, 0);

  db.close();
  fs.removeSync(dir);
});

test('listMemos() offset works with label filter', () => {
  const { dir, db } = createTempDb();

  for (let i = 0; i < 5; i++) {
    createMemo(db, { bodyMd: `Idea ${i}`, labels: ['idea'] });
  }
  for (let i = 0; i < 2; i++) {
    createMemo(db, { bodyMd: `Note ${i}`, labels: ['note'] });
  }

  const memos = listMemos(db, { label: 'idea', limit: 2, offset: 2, order: 'asc' });
  assert.equal(memos.length, 2);
  assert.equal(memos[0].bodyMd, 'Idea 2');
  assert.equal(memos[1].bodyMd, 'Idea 3');

  db.close();
  fs.removeSync(dir);
});

test('listMemos() offset works with search filter', () => {
  const { dir, db } = createTempDb();

  for (let i = 0; i < 5; i++) {
    createMemo(db, { bodyMd: `Meeting notes ${i}` });
  }
  createMemo(db, { bodyMd: 'Other content' });

  const memos = listMemos(db, { search: 'Meeting', limit: 2, offset: 2, order: 'asc' });
  assert.equal(memos.length, 2);
  assert.equal(memos[0].bodyMd, 'Meeting notes 2');
  assert.equal(memos[1].bodyMd, 'Meeting notes 3');

  db.close();
  fs.removeSync(dir);
});

// ============================================================
// clientUuid idempotency (offline-capable clients)
// ============================================================

test('createMemo with clientUuid stores the UUID', () => {
  const { dir, db } = createTempDb();
  const uuid = '11111111-1111-4111-8111-111111111111';

  const memo = createMemo(db, { bodyMd: 'Offline draft', clientUuid: uuid });
  const found = findMemoByClientUuid(db, uuid);

  assert.ok(found, 'should find memo by clientUuid');
  assert.equal(found!.id, memo.id);
  assert.equal(found!.bodyMd, 'Offline draft');

  db.close();
  fs.removeSync(dir);
});

test('createMemo is idempotent when called with the same clientUuid', () => {
  const { dir, db } = createTempDb();
  const uuid = '22222222-2222-4222-8222-222222222222';

  const first = createMemo(db, { bodyMd: 'Retry me', clientUuid: uuid });
  const second = createMemo(db, { bodyMd: 'Retry me', clientUuid: uuid });

  assert.equal(first.id, second.id, 'duplicate POST should return the same memo id');
  assert.equal(countMemos(db, {}), 1, 'only one memo row should exist');

  db.close();
  fs.removeSync(dir);
});

test('createMemo without clientUuid keeps existing non-idempotent behavior', () => {
  const { dir, db } = createTempDb();

  const a = createMemo(db, { bodyMd: 'first' });
  const b = createMemo(db, { bodyMd: 'first' });

  assert.notEqual(a.id, b.id, 'two memos with no clientUuid should produce distinct rows');
  assert.equal(countMemos(db, {}), 2);

  db.close();
  fs.removeSync(dir);
});

test('findMemoByClientUuid returns undefined when no match exists', () => {
  const { dir, db } = createTempDb();
  createMemo(db, { bodyMd: 'unrelated' });

  const result = findMemoByClientUuid(db, '33333333-3333-4333-8333-333333333333');
  assert.equal(result, undefined);

  db.close();
  fs.removeSync(dir);
});

test('addComment with clientUuid stores the UUID', () => {
  const { dir, db } = createTempDb();
  const memo = createMemo(db, { bodyMd: 'parent' });
  const uuid = '44444444-4444-4444-8444-444444444444';

  const comment = addComment(db, memo.id, 'offline reply', uuid);
  const found = findCommentByClientUuid(db, uuid);

  assert.ok(found, 'should find comment by clientUuid');
  assert.equal(found!.id, comment.id);
  assert.equal(found!.bodyMd, 'offline reply');

  db.close();
  fs.removeSync(dir);
});

test('addComment is idempotent when called with the same clientUuid', () => {
  const { dir, db } = createTempDb();
  const memo = createMemo(db, { bodyMd: 'parent' });
  const uuid = '55555555-5555-4555-8555-555555555555';

  const first = addComment(db, memo.id, 'reply', uuid);
  const second = addComment(db, memo.id, 'reply', uuid);

  assert.equal(first.id, second.id, 'duplicate POST should return the same comment id');
  assert.equal(listComments(db, memo.id).length, 1);

  db.close();
  fs.removeSync(dir);
});

test('addComment without clientUuid keeps existing non-idempotent behavior', () => {
  const { dir, db } = createTempDb();
  const memo = createMemo(db, { bodyMd: 'parent' });

  addComment(db, memo.id, 'reply');
  addComment(db, memo.id, 'reply');

  assert.equal(listComments(db, memo.id).length, 2);

  db.close();
  fs.removeSync(dir);
});
