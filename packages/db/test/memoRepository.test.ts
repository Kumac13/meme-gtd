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
