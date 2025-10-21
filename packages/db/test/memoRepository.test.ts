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
  promoteMemo,
  addComment,
  deleteComment,
  listComments,
  listMemoLabels
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
