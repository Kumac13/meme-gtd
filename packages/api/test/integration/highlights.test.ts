import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';
import { createMemoFixture } from '../helpers/fixtures.js';

async function createArticle(app: FastifyInstance, bodyMd = '# Title\n\nThe quick brown fox jumps over the lazy dog.') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/articles',
    payload: {
      title: 'Test Article',
      bodyMd,
      originalUrl: 'https://example.com/article',
      siteName: 'Example',
    },
  });
  assert.strictEqual(res.statusCode, 201);
  return JSON.parse(res.payload);
}

async function createHighlight(app: FastifyInstance, articleId: number, overrides: Record<string, unknown> = {}) {
  const res = await app.inject({
    method: 'POST',
    url: `/api/articles/${articleId}/highlights`,
    payload: { exact: 'quick brown fox', prefix: 'The ', suffix: ' jumps', ...overrides },
  });
  return res;
}

describe('Article Highlight API', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;
    await app.ready();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('creates a highlight on an article (POST .../highlights)', async () => {
    const article = await createArticle(app);
    const res = await createHighlight(app, article.id);

    assert.strictEqual(res.statusCode, 201);
    const highlight = JSON.parse(res.payload);
    assert.strictEqual(highlight.issueId, article.id);
    assert.strictEqual(highlight.exact, 'quick brown fox');
    assert.strictEqual(highlight.prefix, 'The ');
    assert.strictEqual(highlight.suffix, ' jumps');
    assert.strictEqual(highlight.color, 'green');
    assert.strictEqual(highlight.commentCount, 0);
    assert.ok(highlight.id);
  });

  it('rejects empty exact with 400', async () => {
    const article = await createArticle(app);
    const res = await createHighlight(app, article.id, { exact: '' });
    assert.strictEqual(res.statusCode, 400);
  });

  it('returns 404 when highlighting a non-article issue', async () => {
    const memoRes = await app.inject({ method: 'POST', url: '/api/memos', payload: createMemoFixture() });
    const memo = JSON.parse(memoRes.body);
    const res = await createHighlight(app, memo.id);
    assert.strictEqual(res.statusCode, 404);
  });

  it('returns 404 when highlighting a missing article', async () => {
    const res = await createHighlight(app, 999999);
    assert.strictEqual(res.statusCode, 404);
  });

  it('lists highlights for an article (GET .../highlights)', async () => {
    const article = await createArticle(app);
    await createHighlight(app, article.id, { exact: 'quick brown fox' });
    await createHighlight(app, article.id, { exact: 'lazy dog' });

    const res = await app.inject({ method: 'GET', url: `/api/articles/${article.id}/highlights` });
    assert.strictEqual(res.statusCode, 200);
    const highlights = JSON.parse(res.payload);
    assert.strictEqual(highlights.length, 2);
    assert.deepStrictEqual(
      highlights.map((h: { exact: string }) => h.exact).sort(),
      ['lazy dog', 'quick brown fox']
    );
  });

  it('adds a comment to a highlight carrying issueId and highlightId', async () => {
    const article = await createArticle(app);
    const highlight = JSON.parse((await createHighlight(app, article.id)).payload);

    const res = await app.inject({
      method: 'POST',
      url: `/api/articles/${article.id}/highlights/${highlight.id}/comments`,
      payload: { bodyMd: 'A note' },
    });
    assert.strictEqual(res.statusCode, 201);
    const comment = JSON.parse(res.payload);
    assert.strictEqual(comment.bodyMd, 'A note');
    assert.strictEqual(comment.issueId, article.id);
    assert.strictEqual(comment.highlightId, highlight.id);

    // commentCount reflects the new comment
    const listed = JSON.parse((await app.inject({ method: 'GET', url: `/api/articles/${article.id}/highlights` })).payload);
    assert.strictEqual(listed[0].commentCount, 1);
  });

  it('supports multiple comments per highlight, then edit and delete', async () => {
    const article = await createArticle(app);
    const highlight = JSON.parse((await createHighlight(app, article.id)).payload);
    const base = `/api/articles/${article.id}/highlights/${highlight.id}/comments`;

    const c1 = JSON.parse((await app.inject({ method: 'POST', url: base, payload: { bodyMd: 'first' } })).payload);
    await app.inject({ method: 'POST', url: base, payload: { bodyMd: 'second' } });

    let comments = JSON.parse((await app.inject({ method: 'GET', url: base })).payload);
    assert.strictEqual(comments.length, 2);

    const upd = await app.inject({ method: 'PATCH', url: `${base}/${c1.id}`, payload: { bodyMd: 'first edited' } });
    assert.strictEqual(upd.statusCode, 200);
    assert.strictEqual(JSON.parse(upd.payload).bodyMd, 'first edited');

    const del = await app.inject({ method: 'DELETE', url: `${base}/${c1.id}` });
    assert.strictEqual(del.statusCode, 204);

    comments = JSON.parse((await app.inject({ method: 'GET', url: base })).payload);
    assert.strictEqual(comments.length, 1);
    assert.strictEqual(comments[0].bodyMd, 'second');
  });

  it('deleting a highlight soft-deletes its comments too', async () => {
    const article = await createArticle(app);
    const highlight = JSON.parse((await createHighlight(app, article.id)).payload);
    const base = `/api/articles/${article.id}/highlights/${highlight.id}/comments`;
    await app.inject({ method: 'POST', url: base, payload: { bodyMd: 'note 1' } });
    await app.inject({ method: 'POST', url: base, payload: { bodyMd: 'note 2' } });

    const del = await app.inject({ method: 'DELETE', url: `/api/articles/${article.id}/highlights/${highlight.id}` });
    assert.strictEqual(del.statusCode, 204);

    // Highlight gone from the list
    const highlights = JSON.parse((await app.inject({ method: 'GET', url: `/api/articles/${article.id}/highlights` })).payload);
    assert.strictEqual(highlights.length, 0);

    // Its comments are gone too
    const comments = JSON.parse((await app.inject({ method: 'GET', url: base })).payload);
    assert.strictEqual(comments.length, 0);
  });

  it('records highlight and comment events in the activity log', async () => {
    const article = await createArticle(app);
    const highlight = JSON.parse((await createHighlight(app, article.id)).payload);
    const base = `/api/articles/${article.id}/highlights/${highlight.id}/comments`;
    await app.inject({ method: 'POST', url: base, payload: { bodyMd: 'note' } });
    await app.inject({ method: 'DELETE', url: `/api/articles/${article.id}/highlights/${highlight.id}` });

    const log = JSON.parse((await app.inject({ method: 'GET', url: `/api/activity-log/issues/${article.id}` })).payload);
    const events = (log.data ?? log).map((e: { eventType: string }) => e.eventType);
    assert.ok(events.includes('highlight.created'), `expected highlight.created in ${events}`);
    assert.ok(events.includes('comment.created'), `expected comment.created in ${events}`);
    assert.ok(events.includes('comment.deleted'), `expected comment.deleted in ${events}`);
    assert.ok(events.includes('highlight.deleted'), `expected highlight.deleted in ${events}`);
  });
});
