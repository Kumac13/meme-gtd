import { beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';

describe('Task archive and transfer', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;
  beforeEach(async () => { ({ app, cleanup } = await createTestServer()); });
  afterEach(async () => { await cleanup(); });

  async function fixture() {
    const task = (await app.inject({ method: 'POST', url: '/api/tasks', payload: {
      title: 'Context', bodyMd: 'Task body', status: 'next',
      scheduledStart: '2026-11-19T10:00:00', scheduledEnd: '2026-11-19T11:00:00',
    } })).json();
    const comment = (await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/comments`, payload: { bodyMd: 'Separate comment' } })).json();
    await app.inject({ method: 'PATCH', url: `/api/tasks/${task.id}/comments/${comment.id}`, payload: { bodyMd: 'Edited comment' } });
    const removed = (await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/comments`, payload: { bodyMd: 'Deleted comment' } })).json();
    await app.inject({ method: 'DELETE', url: `/api/tasks/${task.id}/comments/${removed.id}` });
    // 過去の日時にして、コピー時の打刻と移動時の保持を区別する。
    app.db.prepare('UPDATE issues SET created_at = ?, updated_at = ? WHERE id = ?')
      .run('2020-01-01T00:00:00.000Z', '2020-02-01T00:00:00.000Z', task.id);
    app.db.prepare('UPDATE comments SET created_at = ?, updated_at = ? WHERE id = ?')
      .run('2020-01-02T00:00:00.000Z', '2020-02-02T00:00:00.000Z', comment.id);
    const label = (await app.inject({ method: 'POST', url: '/api/labels', payload: { name: 'Keep' } })).json();
    await app.inject({ method: 'POST', url: `/api/issues/${task.id}/labels`, payload: { labelId: label.id } });
    const project = (await app.inject({ method: 'POST', url: '/api/projects', payload: { name: 'Project' } })).json();
    await app.inject({ method: 'POST', url: `/api/projects/${project.id}/items`, payload: { issueId: task.id } });
    const other = (await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: 'Related' } })).json();
    await app.inject({ method: 'POST', url: '/api/links', payload: { sourceIssueId: other.id, targetIssueId: task.id, linkType: 'relates' } });
    return { task: (await app.inject({ method: 'GET', url: `/api/tasks/${task.id}` })).json(), commentId: comment.id, project, other };
  }

  it('archives a manual article with separate new comments and operation timestamps, leaving the task unchanged', async () => {
    const { task, commentId, project } = await fixture();
    const original = app.db.prepare('SELECT * FROM issues WHERE id = ?').get(task.id);
    const response = await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/archive-to-article` });
    assert.equal(response.statusCode, 201, response.body);
    const { articleId } = response.json();
    assert.notEqual(articleId, task.id);
    const article = (await app.inject({ method: 'GET', url: `/api/articles/${articleId}` })).json();
    assert.equal(article.title, task.title);
    assert.equal(article.bodyMd, task.bodyMd);
    assert.equal(article.origin, 'manual');
    assert.ok(article.createdAt > task.createdAt);
    assert.equal(article.updatedAt, article.createdAt);
    assert.deepEqual(article.labels, ['Keep']);
    const comments = (await app.inject({ method: 'GET', url: `/api/articles/${articleId}/comments` })).json();
    assert.equal(comments.length, 1);
    assert.notEqual(comments[0].id, commentId);
    assert.equal(comments[0].bodyMd, 'Edited comment');
    assert.equal(comments[0].createdAt, article.createdAt);
    assert.equal(comments[0].updatedAt, article.createdAt);
    assert.deepEqual(app.db.prepare('SELECT * FROM issues WHERE id = ?').get(task.id), original);
    assert.ok(app.db.prepare('SELECT 1 FROM project_items WHERE project_id = ? AND issue_id = ?').get(project.id, articleId));
    assert.ok(app.db.prepare("SELECT 1 FROM links WHERE source_issue_id = ? AND target_issue_id = ? AND link_type = 'derived_from'").get(articleId, task.id));
    assert.ok(app.db.prepare("SELECT 1 FROM activity_log WHERE event_type = 'article.created' AND issue_id = ?").get(articleId));
  });

  it('transfers the same record, preserving identity, all comments, timestamps, bookmark, and relationships', async () => {
    const { task, project, other } = await fixture();
    await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/bookmark` });
    const before = app.db.prepare('SELECT * FROM issues WHERE id = ?').get(task.id) as Record<string, unknown>;
    const comments = app.db.prepare('SELECT * FROM comments WHERE issue_id = ?').all(task.id);
    const links = app.db.prepare('SELECT * FROM links').all();
    const count = (app.db.prepare('SELECT COUNT(*) AS n FROM issues').get() as { n: number }).n;
    const response = await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/transfer-to-memo` });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().memoId, task.id);
    const memo = (await app.inject({ method: 'GET', url: `/api/memos/${task.id}` })).json();
    assert.equal(memo.bodyMd, 'Context\n\nTask body');
    assert.equal(memo.type, 'memo');
    assert.equal(memo.createdAt, before.created_at);
    assert.equal(memo.updatedAt, before.updated_at);
    assert.equal(memo.isBookmarked, true);
    const after = app.db.prepare('SELECT * FROM issues WHERE id = ?').get(task.id) as Record<string, unknown>;
    assert.equal(after.uuid, before.uuid);
    assert.ok(Number(after.server_seq) > Number(before.server_seq));
    assert.equal(after.status, null);
    assert.equal(after.scheduled_start, null);
    assert.equal(after.actual_start, null);
    assert.deepEqual(app.db.prepare('SELECT * FROM comments WHERE issue_id = ?').all(task.id), comments);
    assert.deepEqual(app.db.prepare('SELECT * FROM links').all(), links);
    assert.equal((app.db.prepare('SELECT COUNT(*) AS n FROM issues').get() as { n: number }).n, count);
    assert.deepEqual(memo.labels, ['Keep']);
    assert.ok(app.db.prepare('SELECT 1 FROM project_items WHERE project_id = ? AND issue_id = ?').get(project.id, task.id));
    assert.ok(app.db.prepare('SELECT 1 FROM links WHERE source_issue_id = ? AND target_issue_id = ?').get(other.id, task.id));
    assert.ok(app.db.prepare("SELECT 1 FROM activity_log WHERE event_type = 'issue.transferred' AND issue_id = ?").get(task.id));
    assert.equal((await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/transfer-to-memo` })).statusCode, 404);
  });

  it('rolls back conversion when activity recording fails', async () => {
    const { task } = await fixture();
    const before = app.db.prepare('SELECT * FROM issues WHERE id = ?').get(task.id);
    app.db.exec(`CREATE TRIGGER reject_conversion_log BEFORE INSERT ON activity_log
      WHEN NEW.event_type = 'issue.transferred'
      BEGIN SELECT RAISE(ABORT, 'test log failure'); END`);
    const response = await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/transfer-to-memo` });
    assert.equal(response.statusCode, 500);
    assert.deepEqual(app.db.prepare('SELECT * FROM issues WHERE id = ?').get(task.id), before);
  });

  for (const action of ['archive-to-article', 'transfer-to-memo']) {
    it(`${action} rejects missing tasks and leaves the database unchanged`, async () => {
      const response = await app.inject({ method: 'POST', url: `/api/tasks/999999/${action}` });
      assert.equal(response.statusCode, 404);
      assert.equal((app.db.prepare('SELECT COUNT(*) AS n FROM issues').get() as { n: number }).n, 0);
    });
  }
});
