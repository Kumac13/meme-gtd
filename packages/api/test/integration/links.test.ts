import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';
import { createTaskFixture, createMemoFixture } from '../helpers/fixtures.js';

describe('Link Operations', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const testServer = await createTestServer();
    app = testServer.app;
    cleanup = testServer.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should create a new link (POST /api/links)', async () => {
    // Create two tasks
    const task1Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 1' }),
    });
    const task1 = JSON.parse(task1Response.body);

    const task2Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 2' }),
    });
    const task2 = JSON.parse(task2Response.body);

    // Create link
    const response = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task1.id,
        targetIssueId: task2.id,
        linkType: 'relates',
      },
    });

    if (response.statusCode !== 201) {
      console.error('Error response:', response.body);
    }
    assert.strictEqual(response.statusCode, 201);
    const link = JSON.parse(response.body);
    assert.strictEqual(link.sourceIssueId, task1.id);
    assert.strictEqual(link.targetIssueId, task2.id);
    assert.strictEqual(link.linkType, 'relates');
    assert.ok(link.id);
    assert.ok(link.createdAt);
  });

  // Issue #245: a memo.promoted event must be recorded only when the caller
  // marks the link creation as a promotion — not for any task→memo derived_from
  // link (manual link creation must not fabricate a promotion event).
  it('records memo.promoted when creating a derived_from link with isPromotion (POST /api/links)', async () => {
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'promote me' }),
    });
    const memo = JSON.parse(memoResponse.body);

    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Promoted Task' }),
    });
    const task = JSON.parse(taskResponse.body);

    const linkResponse = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task.id,
        targetIssueId: memo.id,
        linkType: 'derived_from',
        isPromotion: true,
      },
    });
    assert.strictEqual(linkResponse.statusCode, 201);

    const logResponse = await app.inject({
      method: 'GET',
      url: `/api/activity-log/issues/${task.id}`,
    });
    const logs = JSON.parse(logResponse.body);
    const promoted = logs.filter((l: { eventType: string }) => l.eventType === 'memo.promoted');
    assert.strictEqual(promoted.length, 1, 'exactly one memo.promoted event should be recorded');
    assert.strictEqual(promoted[0].payload.source_memo_id, memo.id);
    assert.strictEqual(promoted[0].payload.promoted_task.id, task.id);
  });

  it('does NOT record memo.promoted for a plain task→memo derived_from link (POST /api/links)', async () => {
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'just a reference' }),
    });
    const memo = JSON.parse(memoResponse.body);

    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task' }),
    });
    const task = JSON.parse(taskResponse.body);

    const linkResponse = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task.id,
        targetIssueId: memo.id,
        linkType: 'derived_from',
      },
    });
    assert.strictEqual(linkResponse.statusCode, 201);

    const logResponse = await app.inject({
      method: 'GET',
      url: `/api/activity-log/issues/${task.id}`,
    });
    const logs = JSON.parse(logResponse.body);
    const promoted = logs.filter((l: { eventType: string }) => l.eventType === 'memo.promoted');
    assert.strictEqual(promoted.length, 0, 'manual derived_from link must not record memo.promoted');
  });

  it('should return 400 when creating self-referencing link', async () => {
    // Create a task
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 1' }),
    });
    const task = JSON.parse(taskResponse.body);

    // Try to create self-link
    const response = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task.id,
        targetIssueId: task.id,
        linkType: 'relates',
      },
    });

    assert.strictEqual(response.statusCode, 400);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
    assert.ok(error.message.includes('Cannot link issue to itself'));
  });

  it('should return 400 when creating duplicate link', async () => {
    // Create two tasks
    const task1Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 1' }),
    });
    const task1 = JSON.parse(task1Response.body);

    const task2Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 2' }),
    });
    const task2 = JSON.parse(task2Response.body);

    // Create first link
    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task1.id,
        targetIssueId: task2.id,
        linkType: 'relates',
      },
    });

    // Try to create duplicate
    const response = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task1.id,
        targetIssueId: task2.id,
        linkType: 'relates',
      },
    });

    assert.strictEqual(response.statusCode, 400);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
    assert.ok(error.message.includes('Link already exists'));
  });

  it('should return 404 when creating link with non-existent source issue', async () => {
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 1' }),
    });
    const task = JSON.parse(taskResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: 99999,
        targetIssueId: task.id,
        linkType: 'relates',
      },
    });

    assert.strictEqual(response.statusCode, 404);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'NOT_FOUND');
  });

  it('should list links for an issue with direction (GET /api/issues/:id/links)', async () => {
    // Create three tasks
    const task1Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 1' }),
    });
    const task1 = JSON.parse(task1Response.body);

    const task2Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 2' }),
    });
    const task2 = JSON.parse(task2Response.body);

    const task3Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 3' }),
    });
    const task3 = JSON.parse(task3Response.body);

    // Create outgoing link: task1 -> task2
    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task1.id,
        targetIssueId: task2.id,
        linkType: 'relates',
      },
    });

    // Create incoming link: task3 -> task1
    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task3.id,
        targetIssueId: task1.id,
        linkType: 'parent',
      },
    });

    // Get links for task1
    const response = await app.inject({
      method: 'GET',
      url: `/api/issues/${task1.id}/links`,
    });

    assert.strictEqual(response.statusCode, 200);
    const links = JSON.parse(response.body);
    assert.ok(Array.isArray(links));
    assert.strictEqual(links.length, 2);

    // Check direction fields
    const outgoingLink = links.find((l: any) => l.direction === 'outgoing');
    const incomingLink = links.find((l: any) => l.direction === 'incoming');

    assert.ok(outgoingLink);
    assert.strictEqual(outgoingLink.sourceIssueId, task1.id);
    assert.strictEqual(outgoingLink.targetIssueId, task2.id);
    // Check targetIssue field for outgoing link
    assert.ok(outgoingLink.targetIssue);
    assert.strictEqual(outgoingLink.targetIssue.id, task2.id);
    assert.strictEqual(outgoingLink.targetIssue.type, 'task');
    assert.strictEqual(outgoingLink.targetIssue.title, 'Task 2');

    assert.ok(incomingLink);
    assert.strictEqual(incomingLink.sourceIssueId, task3.id);
    assert.strictEqual(incomingLink.targetIssueId, task1.id);
    // Check targetIssue field for incoming link
    assert.ok(incomingLink.targetIssue);
    assert.strictEqual(incomingLink.targetIssue.id, task3.id);
    assert.strictEqual(incomingLink.targetIssue.type, 'task');
    assert.strictEqual(incomingLink.targetIssue.title, 'Task 3');
  });

  it('should delete a link (DELETE /api/links/:id)', async () => {
    // Create two tasks and a link
    const task1Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 1' }),
    });
    const task1 = JSON.parse(task1Response.body);

    const task2Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 2' }),
    });
    const task2 = JSON.parse(task2Response.body);

    const linkResponse = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task1.id,
        targetIssueId: task2.id,
        linkType: 'relates',
      },
    });
    const link = JSON.parse(linkResponse.body);

    // Delete the link
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/links/${link.id}`,
    });

    assert.strictEqual(response.statusCode, 204);

    // Verify link is deleted
    const listResponse = await app.inject({
      method: 'GET',
      url: `/api/issues/${task1.id}/links`,
    });
    const links = JSON.parse(listResponse.body);
    assert.strictEqual(links.length, 0);
  });

  it('should return 404 when deleting non-existent link', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/links/99999',
    });

    assert.strictEqual(response.statusCode, 404);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'NOT_FOUND');
  });

  it('should support parent-child link types', async () => {
    // Create parent and child tasks
    const parentResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Parent Task' }),
    });
    const parent = JSON.parse(parentResponse.body);

    const childResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Child Task' }),
    });
    const child = JSON.parse(childResponse.body);

    // Create parent link
    const response = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: parent.id,
        targetIssueId: child.id,
        linkType: 'parent',
      },
    });

    assert.strictEqual(response.statusCode, 201);
    const link = JSON.parse(response.body);
    assert.strictEqual(link.linkType, 'parent');
  });

  it('should support derived_from link type (memo promotion)', async () => {
    // Create memo and task
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Original memo' }),
    });
    const memo = JSON.parse(memoResponse.body);

    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Derived Task' }),
    });
    const task = JSON.parse(taskResponse.body);

    // Create derived_from link
    const response = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task.id,
        targetIssueId: memo.id,
        linkType: 'derived_from',
      },
    });

    assert.strictEqual(response.statusCode, 201);
    const link = JSON.parse(response.body);
    assert.strictEqual(link.linkType, 'derived_from');
  });

  // --- API Type Filtering Tests (FR-015: Feature Parity with CLI) ---

  it('should filter links by type=parent (GET /api/issues/:id/links?type=parent)', async () => {
    // Create tasks
    const task1Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 1' }),
    });
    const task1 = JSON.parse(task1Response.body);

    const task2Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 2' }),
    });
    const task2 = JSON.parse(task2Response.body);

    const task3Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 3' }),
    });
    const task3 = JSON.parse(task3Response.body);

    // Create links of different types
    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { sourceIssueId: task1.id, targetIssueId: task2.id, linkType: 'parent' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { sourceIssueId: task1.id, targetIssueId: task3.id, linkType: 'relates' },
    });

    // Filter by parent type
    const response = await app.inject({
      method: 'GET',
      url: `/api/issues/${task1.id}/links?type=parent`,
    });

    assert.strictEqual(response.statusCode, 200);
    const links = JSON.parse(response.body);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].linkType, 'parent');
  });

  it('should filter links by type=child (GET /api/issues/:id/links?type=child)', async () => {
    // Create tasks
    const task1Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Parent Task' }),
    });
    const task1 = JSON.parse(task1Response.body);

    const task2Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Child Task' }),
    });
    const task2 = JSON.parse(task2Response.body);

    // Create child link (task1 --child--> task2)
    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { sourceIssueId: task1.id, targetIssueId: task2.id, linkType: 'child' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { sourceIssueId: task1.id, targetIssueId: task2.id, linkType: 'relates' },
    });

    // Filter by child type
    const response = await app.inject({
      method: 'GET',
      url: `/api/issues/${task1.id}/links?type=child`,
    });

    assert.strictEqual(response.statusCode, 200);
    const links = JSON.parse(response.body);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].linkType, 'child');
  });

  it('should filter links by type=relates (GET /api/issues/:id/links?type=relates)', async () => {
    const task1Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 1' }),
    });
    const task1 = JSON.parse(task1Response.body);

    const task2Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 2' }),
    });
    const task2 = JSON.parse(task2Response.body);

    const task3Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 3' }),
    });
    const task3 = JSON.parse(task3Response.body);

    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { sourceIssueId: task1.id, targetIssueId: task2.id, linkType: 'parent' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { sourceIssueId: task1.id, targetIssueId: task3.id, linkType: 'relates' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/issues/${task1.id}/links?type=relates`,
    });

    assert.strictEqual(response.statusCode, 200);
    const links = JSON.parse(response.body);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].linkType, 'relates');
  });

  it('should return all link types when no filter specified (GET /api/issues/:id/links)', async () => {
    const task1Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 1' }),
    });
    const task1 = JSON.parse(task1Response.body);

    const task2Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 2' }),
    });
    const task2 = JSON.parse(task2Response.body);

    const task3Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 3' }),
    });
    const task3 = JSON.parse(task3Response.body);

    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { sourceIssueId: task1.id, targetIssueId: task2.id, linkType: 'parent' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { sourceIssueId: task1.id, targetIssueId: task3.id, linkType: 'relates' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/issues/${task1.id}/links`,
    });

    assert.strictEqual(response.statusCode, 200);
    const links = JSON.parse(response.body);
    assert.strictEqual(links.length, 2);
    const linkTypes = links.map((l: any) => l.linkType).sort();
    assert.deepStrictEqual(linkTypes, ['parent', 'relates']);
  });

  it('should return 400 for invalid type parameter (GET /api/issues/:id/links?type=invalid)', async () => {
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 1' }),
    });
    const task = JSON.parse(taskResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/issues/${task.id}/links?type=invalid`,
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it('should include targetIssue information with correct type for tasks and memos', async () => {
    // Create a task
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'My Task' }),
    });
    const task = JSON.parse(taskResponse.body);

    // Create a memo
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'This is my memo content that should be truncated if too long' }),
    });
    const memo = JSON.parse(memoResponse.body);

    // Create link from task to memo
    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task.id,
        targetIssueId: memo.id,
        linkType: 'relates',
      },
    });

    // Get links for task
    const response = await app.inject({
      method: 'GET',
      url: `/api/issues/${task.id}/links`,
    });

    assert.strictEqual(response.statusCode, 200);
    const links = JSON.parse(response.body);
    assert.strictEqual(links.length, 1);

    // Verify targetIssue contains memo information
    const link = links[0];
    assert.ok(link.targetIssue);
    assert.strictEqual(link.targetIssue.id, memo.id);
    assert.strictEqual(link.targetIssue.type, 'memo');
    assert.ok(link.targetIssue.title.includes('This is my memo content'));
  });

  it('should include status in targetIssue for tasks and null for memos', async () => {
    // Create a task with specific status
    const task1Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task with status', status: 'next' }),
    });
    const task1 = JSON.parse(task1Response.body);

    // Create another task to link to
    const task2Response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Target Task', status: 'waiting' }),
    });
    const task2 = JSON.parse(task2Response.body);

    // Create a memo
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Target Memo' }),
    });
    const memo = JSON.parse(memoResponse.body);

    // Create links from task1 to task2 and memo
    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { sourceIssueId: task1.id, targetIssueId: task2.id, linkType: 'relates' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { sourceIssueId: task1.id, targetIssueId: memo.id, linkType: 'relates' },
    });

    // Get links for task1
    const response = await app.inject({
      method: 'GET',
      url: `/api/issues/${task1.id}/links`,
    });

    assert.strictEqual(response.statusCode, 200);
    const links = JSON.parse(response.body);
    assert.strictEqual(links.length, 2);

    // Find task and memo links
    const taskLink = links.find((l: any) => l.targetIssue.type === 'task');
    const memoLink = links.find((l: any) => l.targetIssue.type === 'memo');

    // Task should have status
    assert.ok(taskLink);
    assert.strictEqual(taskLink.targetIssue.status, 'waiting');

    // Memo should have null status
    assert.ok(memoLink);
    assert.strictEqual(memoLink.targetIssue.status, null);
  });

  it('should include targetIssue information with correct type for articles', async () => {
    // Create a task
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'My Task' }),
    });
    const task = JSON.parse(taskResponse.body);

    // Create an article
    const articleResponse = await app.inject({
      method: 'POST',
      url: '/api/articles',
      payload: {
        title: 'Test Article',
        bodyMd: 'Article body content',
        originalUrl: 'https://example.com/article',
      },
    });
    assert.strictEqual(articleResponse.statusCode, 201);
    const article = JSON.parse(articleResponse.body);

    // Create link from task to article
    const linkResponse = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task.id,
        targetIssueId: article.id,
        linkType: 'relates',
      },
    });
    assert.strictEqual(linkResponse.statusCode, 201);

    // Get links for task
    const response = await app.inject({
      method: 'GET',
      url: `/api/issues/${task.id}/links`,
    });

    assert.strictEqual(response.statusCode, 200);
    const links = JSON.parse(response.body);
    assert.strictEqual(links.length, 1);

    // Verify targetIssue contains article information
    const link = links[0];
    assert.ok(link.targetIssue);
    assert.strictEqual(link.targetIssue.id, article.id);
    assert.strictEqual(link.targetIssue.type, 'article');
    assert.strictEqual(link.targetIssue.title, 'Test Article');
    assert.strictEqual(link.targetIssue.status, null);
  });
});
