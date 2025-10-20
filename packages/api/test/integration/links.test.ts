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

    assert.ok(incomingLink);
    assert.strictEqual(incomingLink.sourceIssueId, task3.id);
    assert.strictEqual(incomingLink.targetIssueId, task1.id);
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
});
