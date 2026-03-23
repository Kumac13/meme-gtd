import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import type { FastifyInstance } from 'fastify';
import {
  createMemo,
  createTask,
  addComment,
  attachLabelToIssue,
  createLabel,
  searchByKeyword,
  getIssueLabels,
} from 'meme-gtd-db';

describe('Keyword Search', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  before(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;
    await app.ready();
  });

  after(async () => {
    await cleanup();
  });

  it('should find issues matching keyword in body and title', () => {
    const memo = createMemo(app.db, { bodyMd: 'apple banana fruit' });
    const task = createTask(app.db, { title: 'apple pie recipe', bodyMd: 'bake at 350' });

    const results = searchByKeyword(app.db, 'apple');
    const ids = results.map((r) => r.id);

    assert.ok(ids.includes(memo.id), 'Should find memo with apple in body');
    assert.ok(ids.includes(task.id), 'Should find task with apple in title');
  });

  it('should return matches with field=issue and text for issue matches', () => {
    const memo = createMemo(app.db, { bodyMd: 'unique_keyword_xyz test content' });

    const results = searchByKeyword(app.db, 'unique_keyword_xyz');
    const found = results.find((r) => r.id === memo.id);

    assert.ok(found);
    assert.strictEqual(found.matches.length, 1);
    assert.strictEqual(found.matches[0].field, 'issue');
    assert.strictEqual(found.matches[0].commentId, null);
    assert.strictEqual(found.matches[0].text, 'unique_keyword_xyz test content');
  });

  it('should find issues where only a comment matches', () => {
    const memo = createMemo(app.db, { bodyMd: 'no keyword here' });
    addComment(app.db, memo.id, 'grape juice is delicious');

    const results = searchByKeyword(app.db, 'grape');
    const found = results.find((r) => r.id === memo.id);

    assert.ok(found, 'Should find memo via comment match');
    assert.strictEqual(found.matches.length, 1);
    assert.strictEqual(found.matches[0].field, 'comment');
    assert.ok(found.matches[0].commentId !== null, 'Should have commentId');
    assert.strictEqual(found.matches[0].text, 'grape juice is delicious');
  });

  it('should group multiple comment matches under one issue', () => {
    const memo = createMemo(app.db, { bodyMd: 'no match in body' });
    addComment(app.db, memo.id, 'multiword_abc first comment');
    addComment(app.db, memo.id, 'multiword_abc second comment');

    const results = searchByKeyword(app.db, 'multiword_abc');
    const found = results.find((r) => r.id === memo.id);

    assert.ok(found);
    assert.strictEqual(found.matches.length, 2);
    assert.ok(found.matches.every((m) => m.field === 'comment'));
  });

  it('should filter by types', () => {
    createMemo(app.db, { bodyMd: 'filtertest_abc memo content' });
    createTask(app.db, { title: 'filtertest_abc task', bodyMd: '' });

    const memoOnly = searchByKeyword(app.db, 'filtertest_abc', { types: ['memo'] });
    assert.ok(memoOnly.every((r) => r.type === 'memo'));
    assert.ok(memoOnly.length >= 1);

    const taskOnly = searchByKeyword(app.db, 'filtertest_abc', { types: ['task'] });
    assert.ok(taskOnly.every((r) => r.type === 'task'));
    assert.ok(taskOnly.length >= 1);
  });

  it('should respect limit', () => {
    createMemo(app.db, { bodyMd: 'limitword_qrs first' });
    createMemo(app.db, { bodyMd: 'limitword_qrs second' });
    createMemo(app.db, { bodyMd: 'limitword_qrs third' });

    const results = searchByKeyword(app.db, 'limitword_qrs', { limit: 1 });
    assert.strictEqual(results.length, 1);
  });

  it('should return empty array when nothing matches', () => {
    const results = searchByKeyword(app.db, 'zzz_nonexistent_term_999');
    assert.strictEqual(results.length, 0);
  });

  it('should include labels in results', () => {
    const memo = createMemo(app.db, { bodyMd: 'labeltest_uvw content' });
    const label = createLabel(app.db, 'test-label-search');
    attachLabelToIssue(app.db, memo.id, label.id);

    const results = searchByKeyword(app.db, 'labeltest_uvw');
    const found = results.find((r) => r.id === memo.id);

    assert.ok(found);
    assert.ok(found.labels.includes('test-label-search'));
  });

  it('should include commentCount in results', () => {
    const memo = createMemo(app.db, { bodyMd: 'counttest_def content' });
    addComment(app.db, memo.id, 'comment 1');
    addComment(app.db, memo.id, 'comment 2');

    const results = searchByKeyword(app.db, 'counttest_def');
    const found = results.find((r) => r.id === memo.id);

    assert.ok(found);
    assert.strictEqual(found.commentCount, 2);
  });

  it('should return title when matching title', () => {
    const task = createTask(app.db, { title: 'titlematch_ghi task', bodyMd: 'some body' });

    const results = searchByKeyword(app.db, 'titlematch_ghi');
    const found = results.find((r) => r.id === task.id);

    assert.ok(found);
    assert.strictEqual(found.matches[0].field, 'issue');
    assert.strictEqual(found.matches[0].text, 'titlematch_ghi task');
    assert.strictEqual(found.title, 'titlematch_ghi task');
  });
});

describe('getIssueLabels', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  before(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;
    await app.ready();
  });

  after(async () => {
    await cleanup();
  });

  it('should return labels for an issue', () => {
    const memo = createMemo(app.db, { bodyMd: 'label issue test' });
    const label = createLabel(app.db, 'generic-label');
    attachLabelToIssue(app.db, memo.id, label.id);

    const labels = getIssueLabels(app.db, memo.id);
    assert.ok(labels.includes('generic-label'));
  });

  it('should return empty array for issue with no labels', () => {
    const memo = createMemo(app.db, { bodyMd: 'no labels here' });
    const labels = getIssueLabels(app.db, memo.id);
    assert.strictEqual(labels.length, 0);
  });
});
