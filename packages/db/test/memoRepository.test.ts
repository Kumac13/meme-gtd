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
  promoteMemo,
  addComment,
  deleteComment,
  listComments,
  listMemoLabels,
  deleteMemo,
  setBookmark
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

test('promote memo to task', () => {
  const { dir, db } = createTempDb();
  const memo = createMemo(db, { bodyMd: 'draft task' });
  const result = promoteMemo(db, { memoId: memo.id, title: 'task title' });
  assert.ok(result.taskId > 0);
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
