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

describe('GET /api/search/keyword', () => {
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

  it('should return results matching query', async () => {
    createMemo(app.db, { bodyMd: 'api_keyword_test_alpha memo content' });
    createTask(app.db, { title: 'api_keyword_test_alpha task', bodyMd: '' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=api_keyword_test_alpha',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.results.length >= 2);
    assert.strictEqual(body.total, body.results.length);
    assert.ok(body.results.every((r: any) => r.matches.length > 0));
  });

  it('should filter by types parameter', async () => {
    createMemo(app.db, { bodyMd: 'api_type_filter_beta content' });
    createTask(app.db, { title: 'api_type_filter_beta task', bodyMd: '' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=api_type_filter_beta&types=memo',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.results.length >= 1);
    assert.ok(body.results.every((r: any) => r.type === 'memo'));
  });

  it('should respect limit parameter', async () => {
    createMemo(app.db, { bodyMd: 'api_limit_gamma first' });
    createMemo(app.db, { bodyMd: 'api_limit_gamma second' });
    createMemo(app.db, { bodyMd: 'api_limit_gamma third' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=api_limit_gamma&limit=1',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.results.length, 1);
  });

  it('should return empty results for non-matching query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=zzz_nonexistent_api_term_999',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.results.length, 0);
    assert.strictEqual(body.total, 0);
  });

  it('should include labels, commentCount, and matches in response', async () => {
    const memo = createMemo(app.db, { bodyMd: 'api_fields_delta content' });
    const label = createLabel(app.db, 'api-test-label');
    attachLabelToIssue(app.db, memo.id, label.id);
    addComment(app.db, memo.id, 'api_fields_delta comment match');

    const res = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=api_fields_delta',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    const found = body.results.find((r: any) => r.id === memo.id);

    assert.ok(found);
    assert.ok(found.labels.includes('api-test-label'));
    assert.strictEqual(found.commentCount, 1);
    assert.ok(found.matches.length >= 2); // issue match + comment match
  });

  it('should return 400 when q is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search/keyword',
    });

    assert.ok(res.statusCode >= 400);
  });

  it('should filter by status parameter', async () => {
    createTask(app.db, { title: 'api_status_filter_epsilon open task', bodyMd: '', status: 'open' });
    createTask(app.db, { title: 'api_status_filter_epsilon done task', bodyMd: '', status: 'done' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=api_status_filter_epsilon&status=open',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.results.length >= 1);
    assert.ok(body.results.every((r: any) => r.status === 'open'));
  });

  it('should filter by label parameter', async () => {
    const memo1 = createMemo(app.db, { bodyMd: 'api_label_filter_zeta content 1' });
    const memo2 = createMemo(app.db, { bodyMd: 'api_label_filter_zeta content 2' });
    const labelA = createLabel(app.db, 'api-label-filter-a');
    attachLabelToIssue(app.db, memo1.id, labelA.id);

    const res = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=api_label_filter_zeta&label=api-label-filter-a',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.results.length, 1);
    assert.strictEqual(body.results[0].id, memo1.id);
  });

  it('should support offset for pagination', async () => {
    createMemo(app.db, { bodyMd: 'api_offset_eta first' });
    createMemo(app.db, { bodyMd: 'api_offset_eta second' });
    createMemo(app.db, { bodyMd: 'api_offset_eta third' });

    const res1 = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=api_offset_eta&limit=2&offset=0',
    });
    const body1 = JSON.parse(res1.payload);
    assert.strictEqual(body1.results.length, 2);
    assert.strictEqual(body1.limit, 2);
    assert.strictEqual(body1.offset, 0);

    const res2 = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=api_offset_eta&limit=2&offset=2',
    });
    const body2 = JSON.parse(res2.payload);
    assert.ok(body2.results.length >= 1);
    assert.strictEqual(body2.offset, 2);

    // No overlap between pages
    const ids1 = body1.results.map((r: any) => r.id);
    const ids2 = body2.results.map((r: any) => r.id);
    assert.ok(ids1.every((id: number) => !ids2.includes(id)));
  });

  it('should support order parameter', async () => {
    createMemo(app.db, { bodyMd: 'api_order_theta content' });

    const resDesc = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=api_order_theta&order=desc',
    });
    assert.strictEqual(resDesc.statusCode, 200);

    const resAsc = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=api_order_theta&order=asc',
    });
    assert.strictEqual(resAsc.statusCode, 200);
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
