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
  setBookmark,
} from 'meme-gtd-db';
import { SearchResultItemSchema } from '../../src/schemas/searchSchemas.js';

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

  it('should filter by bookmarked parameter', async () => {
    const memo1 = createMemo(app.db, { bodyMd: 'api_bookmark_iota first' });
    const memo2 = createMemo(app.db, { bodyMd: 'api_bookmark_iota second' });
    setBookmark(app.db, memo1.id, true);

    const resAll = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=api_bookmark_iota',
    });
    const bodyAll = JSON.parse(resAll.payload);
    assert.ok(bodyAll.results.length >= 2);

    const resBookmarked = await app.inject({
      method: 'GET',
      url: '/api/search/keyword?q=api_bookmark_iota&bookmarked=true',
    });
    const bodyBookmarked = JSON.parse(resBookmarked.payload);
    assert.strictEqual(bodyBookmarked.results.length, 1);
    assert.strictEqual(bodyBookmarked.results[0].id, memo1.id);
    assert.strictEqual(bodyBookmarked.results[0].isBookmarked, true);
  });
});

describe('SearchResultItemSchema validation', () => {
  it('should validate a complete semantic search result item', () => {
    const validItem = {
      issue: {
        id: 1,
        type: 'task',
        title: 'Test task',
        bodyMd: 'Some content',
        status: 'open',
        isBookmarked: true,
        labels: ['label-a', 'label-b'],
        commentCount: 3,
        taskKind: 'action',
        scheduledOn: '2026-04-04',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      },
      score: 0.85,
      vectorScore: 0.85,
      matchReason: ['vector_similarity'],
    };

    const result = SearchResultItemSchema.safeParse(validItem);
    assert.ok(result.success, 'Should validate a complete item');
  });

  it('should validate item with nullable fields set to null', () => {
    const itemWithNulls = {
      issue: {
        id: 2,
        type: 'memo',
        title: null,
        bodyMd: 'Memo content',
        status: null,
        isBookmarked: false,
        labels: [],
        commentCount: 0,
        taskKind: null,
        scheduledOn: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      },
      score: 0.42,
      vectorScore: 0.42,
      matchReason: ['vector_similarity'],
    };

    const result = SearchResultItemSchema.safeParse(itemWithNulls);
    assert.ok(result.success, 'Should validate item with null fields');
  });

  it('should reject item missing required fields', () => {
    const incompleteItem = {
      issue: {
        id: 3,
        type: 'task',
        title: 'Test',
        bodyMd: 'Content',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        // missing: status, isBookmarked, labels, commentCount, taskKind, scheduledOn
      },
      score: 0.5,
      vectorScore: 0.5,
      matchReason: ['vector_similarity'],
    };

    const result = SearchResultItemSchema.safeParse(incompleteItem);
    assert.ok(!result.success, 'Should reject item missing required fields');
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

describe('POST /api/search/export', () => {
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

  it('should export memo search results as JSON and log search.exported', async () => {
    const memo1 = createMemo(app.db, { bodyMd: 'export_alpha_memo content 1' });
    const memo2 = createMemo(app.db, { bodyMd: 'export_alpha_memo content 2' });
    const label = createLabel(app.db, 'export-test-label');
    attachLabelToIssue(app.db, memo1.id, label.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: { query: 'export_alpha_memo', labels: ['export-test-label'] },
        itemIds: [memo1.id, memo2.id],
        includeComments: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.type, 'memos');
    assert.strictEqual(body.total, 2);
    assert.deepStrictEqual(body.filters, {
      query: 'export_alpha_memo',
      labels: ['export-test-label'],
    });
    assert.strictEqual(body.results.length, 2);
    assert.strictEqual(body.results[0].id, memo1.id);
    assert.strictEqual(body.results[0].type, 'memo');
    assert.ok(body.results[0].labels.includes('export-test-label'));
    assert.strictEqual(body.results[1].id, memo2.id);
    assert.ok(body.results[0].comments === undefined);

    // Verify activity_log entry was written
    const logRow = app.db
      .prepare(
        `SELECT event_type, payload FROM activity_log WHERE event_type = 'search.exported' ORDER BY id DESC LIMIT 1`
      )
      .get() as { event_type: string; payload: string } | undefined;
    assert.ok(logRow);
    assert.strictEqual(logRow.event_type, 'search.exported');
    const payload = JSON.parse(logRow.payload);
    assert.strictEqual(payload.issue_type, 'memo');
    assert.strictEqual(payload.item_count, 2);
    assert.strictEqual(payload.include_comments, false);
    assert.deepStrictEqual(payload.filters, {
      query: 'export_alpha_memo',
      labels: ['export-test-label'],
    });
  });

  it('should include comments when includeComments=true', async () => {
    const memo = createMemo(app.db, { bodyMd: 'export_comments_memo body' });
    addComment(app.db, memo.id, 'first comment text');
    addComment(app.db, memo.id, 'second comment text');

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: { query: 'export_comments_memo' },
        itemIds: [memo.id],
        includeComments: true,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.results.length, 1);
    assert.ok(Array.isArray(body.results[0].comments));
    assert.strictEqual(body.results[0].comments.length, 2);
    assert.strictEqual(body.results[0].comments[0].bodyMd, 'first comment text');
    assert.strictEqual(body.results[0].comments[1].bodyMd, 'second comment text');
  });

  it('should include matchedComment when provided by client', async () => {
    const memo = createMemo(app.db, { bodyMd: 'export_matched_memo body' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: { query: 'snippet_query' },
        itemIds: [memo.id],
        matchedComments: { [String(memo.id)]: 'this comment snippet matched' },
        includeComments: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.results[0].matchedComment, 'this comment snippet matched');
  });

  it('should preserve the client-provided order of itemIds', async () => {
    const memo1 = createMemo(app.db, { bodyMd: 'order_memo one' });
    const memo2 = createMemo(app.db, { bodyMd: 'order_memo two' });
    const memo3 = createMemo(app.db, { bodyMd: 'order_memo three' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: {},
        itemIds: [memo3.id, memo1.id, memo2.id],
        includeComments: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.deepStrictEqual(
      body.results.map((r: { id: number }) => r.id),
      [memo3.id, memo1.id, memo2.id]
    );
  });

  it('should export tasks with title, status, and scheduledOn', async () => {
    const task = createTask(app.db, {
      title: 'export_task_title',
      bodyMd: 'task body',
      status: 'open',
      scheduledOn: '2026-04-15',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'tasks',
        filters: { status: 'open' },
        itemIds: [task.id],
        includeComments: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.results.length, 1);
    assert.strictEqual(body.results[0].type, 'task');
    assert.strictEqual(body.results[0].title, 'export_task_title');
    assert.strictEqual(body.results[0].status, 'open');
    assert.strictEqual(body.results[0].scheduledOn, '2026-04-15');
  });

  it('should drop empty/nullish filter keys when logging and returning', async () => {
    const memo = createMemo(app.db, { bodyMd: 'filter_clean_memo' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: { query: '', labels: [], dateFrom: '2026-04-01' },
        itemIds: [memo.id],
        includeComments: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.deepStrictEqual(body.filters, { dateFrom: '2026-04-01' });
  });

  it('should return empty results when itemIds is empty and still log the event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: { query: 'nothing' },
        itemIds: [],
        includeComments: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.total, 0);
    assert.strictEqual(body.results.length, 0);

    const logRow = app.db
      .prepare(
        `SELECT payload FROM activity_log WHERE event_type = 'search.exported' ORDER BY id DESC LIMIT 1`
      )
      .get() as { payload: string } | undefined;
    assert.ok(logRow);
    const payload = JSON.parse(logRow.payload);
    assert.strictEqual(payload.item_count, 0);
  });

  it('should reject items of a different type', async () => {
    const task = createTask(app.db, { title: 'wrong_type_task', bodyMd: '' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: {},
        itemIds: [task.id],
        includeComments: false,
      },
    });

    // The task's ID is not found when filtered by type = 'memo' so it's dropped
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.results.length, 0);
  });

  it('should return 400 for invalid request body (missing required fields)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        // `type` and `itemIds` are required by SearchExportRequestSchema
        filters: {},
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const error = JSON.parse(res.payload);
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
  });

  it('should return 400 for an invalid export type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'invalid_type',
        filters: {},
        itemIds: [1],
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const error = JSON.parse(res.payload);
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
  });
});

describe('POST /api/search/export (scope="all")', () => {
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

  it('exports every memo matching the filter, ignoring itemIds, and logs the full count', async () => {
    createLabel(app.db, 'scope-all-label');
    const m1 = createMemo(app.db, { bodyMd: 'scope all one', labels: ['scope-all-label'] });
    const m2 = createMemo(app.db, { bodyMd: 'scope all two', labels: ['scope-all-label'] });
    const m3 = createMemo(app.db, { bodyMd: 'scope all three', labels: ['scope-all-label'] });

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: { labels: ['scope-all-label'] },
        // Only one item is "loaded" on the client — scope="all" must ignore this.
        itemIds: [m1.id],
        scope: 'all',
        includeComments: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.total, 3);
    assert.strictEqual(body.truncated, false);
    const ids = body.results.map((r: { id: number }) => r.id).sort((a: number, b: number) => a - b);
    assert.deepStrictEqual(ids, [m1.id, m2.id, m3.id].sort((a, b) => a - b));

    // Activity log records the full matched count, not the loaded itemIds length.
    const logRow = app.db
      .prepare(
        `SELECT payload FROM activity_log WHERE event_type = 'search.exported' ORDER BY id DESC LIMIT 1`
      )
      .get() as { payload: string } | undefined;
    assert.ok(logRow);
    assert.strictEqual(JSON.parse(logRow.payload).item_count, 3);
  });

  it('applies the date range filter server-side', async () => {
    createLabel(app.db, 'scope-date-label');
    const inRange1 = createMemo(app.db, {
      bodyMd: 'date one',
      labels: ['scope-date-label'],
      createdAt: '2026-03-10T00:00:00',
    });
    const inRange2 = createMemo(app.db, {
      bodyMd: 'date two',
      labels: ['scope-date-label'],
      createdAt: '2026-03-20T00:00:00',
    });
    createMemo(app.db, {
      bodyMd: 'date out',
      labels: ['scope-date-label'],
      createdAt: '2026-05-01T00:00:00',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: { labels: ['scope-date-label'], dateFrom: '2026-03-01', dateTo: '2026-03-31' },
        itemIds: [],
        scope: 'all',
        includeComments: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.total, 2);
    const ids = body.results.map((r: { id: number }) => r.id).sort((a: number, b: number) => a - b);
    assert.deepStrictEqual(ids, [inRange1.id, inRange2.id].sort((a, b) => a - b));
  });

  it('includes comments for every matched item', async () => {
    createLabel(app.db, 'scope-comments-label');
    const m1 = createMemo(app.db, { bodyMd: 'sc comments one', labels: ['scope-comments-label'] });
    addComment(app.db, m1.id, 'c1');
    const m2 = createMemo(app.db, { bodyMd: 'sc comments two', labels: ['scope-comments-label'] });
    addComment(app.db, m2.id, 'c2a');
    addComment(app.db, m2.id, 'c2b');

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: { labels: ['scope-comments-label'] },
        itemIds: [m1.id],
        scope: 'all',
        includeComments: true,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.total, 2);
    const r1 = body.results.find((r: { id: number }) => r.id === m1.id);
    const r2 = body.results.find((r: { id: number }) => r.id === m2.id);
    assert.strictEqual(r1.comments.length, 1);
    assert.strictEqual(r2.comments.length, 2);
  });

  it('rebuilds matchedComment snippets server-side for keyword search', async () => {
    const m1 = createMemo(app.db, { bodyMd: 'scopekwxyz body match only' });
    const m2 = createMemo(app.db, { bodyMd: 'no body match here at all' });
    addComment(app.db, m2.id, 'scopekwxyz matched in comment');

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: { query: 'scopekwxyz', searchMode: 'keyword' },
        // No matched snippets provided by the client — server must rebuild them.
        itemIds: [],
        scope: 'all',
        includeComments: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.total, 2);
    const r2 = body.results.find((r: { id: number }) => r.id === m2.id);
    assert.ok(r2.matchedComment && r2.matchedComment.includes('scopekwxyz'));
    const r1 = body.results.find((r: { id: number }) => r.id === m1.id);
    // m1 matched in body only, so it carries no comment snippet.
    assert.strictEqual(r1.matchedComment, undefined);
  });

  it('falls back to the loaded itemIds for semantic search (no "all" expansion)', async () => {
    const m1 = createMemo(app.db, { bodyMd: 'sem_fallback one' });
    createMemo(app.db, { bodyMd: 'sem_fallback two' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: { query: 'sem_fallback', searchMode: 'semantic' },
        itemIds: [m1.id],
        scope: 'all',
        includeComments: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    // Semantic stays scoped to the client-provided itemIds — not expanded to all.
    assert.strictEqual(body.total, 1);
    assert.strictEqual(body.results[0].id, m1.id);
  });

  it('exports every task matching the status filter', async () => {
    createLabel(app.db, 'scope-task-label');
    const t1 = createTask(app.db, { title: 'st open 1', bodyMd: '', status: 'open', labels: ['scope-task-label'] });
    const t2 = createTask(app.db, { title: 'st open 2', bodyMd: '', status: 'open', labels: ['scope-task-label'] });
    createTask(app.db, { title: 'st done', bodyMd: '', status: 'done', labels: ['scope-task-label'] });

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'tasks',
        filters: { labels: ['scope-task-label'], status: 'open' },
        itemIds: [],
        scope: 'all',
        includeComments: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.total, 2);
    const ids = body.results.map((r: { id: number }) => r.id).sort((a: number, b: number) => a - b);
    assert.deepStrictEqual(ids, [t1.id, t2.id].sort((a, b) => a - b));
  });

  it('defaults to loaded scope (itemIds) when scope is omitted', async () => {
    createLabel(app.db, 'scope-default-label');
    const m1 = createMemo(app.db, { bodyMd: 'default scope one', labels: ['scope-default-label'] });
    createMemo(app.db, { bodyMd: 'default scope two', labels: ['scope-default-label'] });

    const res = await app.inject({
      method: 'POST',
      url: '/api/search/export',
      payload: {
        type: 'memos',
        filters: { labels: ['scope-default-label'] },
        itemIds: [m1.id],
        includeComments: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    // Without scope="all", only the single loaded item is exported.
    assert.strictEqual(body.total, 1);
    assert.strictEqual(body.results[0].id, m1.id);
    assert.strictEqual(body.truncated, false);
  });
});
