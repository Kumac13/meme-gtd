import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';

describe('Task CRUD Operations', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  // Helper to create a task for testing
  const createTaskFixture = (overrides = {}) => ({
    title: 'Test Task',
    bodyMd: 'Test task body',
    ...overrides,
  });

  it('should create a new task (POST /api/tasks)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });

    assert.strictEqual(response.statusCode, 201);
    const task = JSON.parse(response.body);
    assert.strictEqual(task.type, 'task');
    assert.strictEqual(task.title, 'Test Task');
    assert.strictEqual(task.bodyMd, 'Test task body');
    assert.strictEqual(task.status, 'open'); // Default status
    assert.ok(task.id);
    assert.ok(task.createdAt);
    assert.ok(task.updatedAt);
  });

  it('should return 400 when creating task without title', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { bodyMd: 'Body without title' },
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it('should list all tasks (GET /api/tasks)', async () => {
    // Create two tasks
    await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 1' }),
    });
    await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task 2' }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks',
    });

    assert.strictEqual(response.statusCode, 200);
    const tasks = JSON.parse(response.body);
    assert.ok(Array.isArray(tasks));
    assert.strictEqual(tasks.length, 2);
    // T018: Assert labels field exists and is an array
    tasks.forEach((task: any) => {
      assert.ok(Array.isArray(task.labels), 'labels should be an array');
    });
  });

  it('should filter tasks by status (GET /api/tasks?status=next)', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ status: 'open' }),
    });
    await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ status: 'next' }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks?status=next',
    });

    assert.strictEqual(response.statusCode, 200);
    const tasks = JSON.parse(response.body);
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].status, 'next');
  });

  it('should filter bookmarked tasks (GET /api/tasks?bookmarked=true)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/bookmark`,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks?bookmarked=true',
    });

    assert.strictEqual(response.statusCode, 200);
    const tasks = JSON.parse(response.body);
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].isBookmarked, true);
  });

  it('should get task by ID (GET /api/tasks/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Specific Task' }),
    });
    const created = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/tasks/${created.id}`,
    });

    assert.strictEqual(response.statusCode, 200);
    const task = JSON.parse(response.body);
    assert.strictEqual(task.id, created.id);
    assert.strictEqual(task.title, 'Specific Task');
    // T019: Assert labels field exists
    assert.ok(Array.isArray(task.labels), 'labels should be an array');
  });

  it('should return 404 when task not found (GET /api/tasks/:id)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks/99999',
    });

    assert.strictEqual(response.statusCode, 404);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'NOT_FOUND');
  });

  it('should update task (PATCH /api/tasks/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      payload: { title: 'Updated Title' },
    });

    assert.strictEqual(response.statusCode, 200);
    const updated = JSON.parse(response.body);
    assert.strictEqual(updated.title, 'Updated Title');
  });

  it('should delete task (DELETE /api/tasks/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/tasks/${task.id}`,
    });

    assert.strictEqual(deleteResponse.statusCode, 204);

    // Verify task is deleted (soft delete)
    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/tasks/${task.id}`,
    });

    assert.strictEqual(getResponse.statusCode, 404);
  });

  it('should return task with labels (GET /api/tasks/:id) - T020', async () => {
    // Create a task
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task with labels' }),
    });
    const task = JSON.parse(createResponse.body);

    // Create labels and get their IDs
    const label1Response = await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'bug' },
    });
    const label1 = JSON.parse(label1Response.body);

    const label2Response = await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'urgent' },
    });
    const label2 = JSON.parse(label2Response.body);

    // Assign labels to task (one at a time)
    await app.inject({
      method: 'POST',
      url: `/api/issues/${task.id}/labels`,
      payload: { labelId: label1.id },
    });
    await app.inject({
      method: 'POST',
      url: `/api/issues/${task.id}/labels`,
      payload: { labelId: label2.id },
    });

    // Get task with labels
    const response = await app.inject({
      method: 'GET',
      url: `/api/tasks/${task.id}`,
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.ok(Array.isArray(result.labels));
    assert.strictEqual(result.labels.length, 2);
    assert.ok(result.labels.includes('bug'));
    assert.ok(result.labels.includes('urgent'));
  });

  it('should return task without labels (empty array) - T021', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task without labels' }),
    });
    const task = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/tasks/${task.id}`,
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.ok(Array.isArray(result.labels));
    assert.strictEqual(result.labels.length, 0);
  });
});

describe('Task Status Transition Operations', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  const createTaskFixture = (overrides = {}) => ({
    title: 'Test Task',
    bodyMd: 'Test task body',
    ...overrides,
  });

  it('should close task (POST /api/tasks/:id/close)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/close`,
    });

    assert.strictEqual(response.statusCode, 200);
    const closed = JSON.parse(response.body);
    assert.strictEqual(closed.status, 'done');
  });

  it('should cancel task (POST /api/tasks/:id/cancel)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/cancel`,
    });

    assert.strictEqual(response.statusCode, 200);
    const canceled = JSON.parse(response.body);
    assert.strictEqual(canceled.status, 'canceled');
  });

  it('should reopen task (POST /api/tasks/:id/reopen)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ status: 'done' }),
    });
    const task = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/reopen`,
    });

    assert.strictEqual(response.statusCode, 200);
    const reopened = JSON.parse(response.body);
    assert.strictEqual(reopened.status, 'open');
  });

  it('should return 404 when closing non-existent task', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks/99999/close',
    });

    assert.strictEqual(response.statusCode, 404);
  });
});

describe('Task Bookmark Operations', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  const createTaskFixture = (overrides = {}) => ({
    title: 'Test Task',
    bodyMd: 'Test task body',
    ...overrides,
  });

  it('should bookmark a task (POST /api/tasks/:id/bookmark)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/bookmark`,
    });

    assert.strictEqual(response.statusCode, 200);
    const bookmarked = JSON.parse(response.body);
    assert.strictEqual(bookmarked.isBookmarked, true);
    assert.strictEqual(bookmarked.id, task.id);
  });

  it('should unbookmark a task (POST /api/tasks/:id/unbookmark)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    // First bookmark it
    await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/bookmark`,
    });

    // Then unbookmark
    const response = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/unbookmark`,
    });

    assert.strictEqual(response.statusCode, 200);
    const unbookmarked = JSON.parse(response.body);
    assert.strictEqual(unbookmarked.isBookmarked, false);
  });

  it('should return 404 when bookmarking non-existent task', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks/99999/bookmark',
    });

    assert.strictEqual(response.statusCode, 404);
  });

  it('should return 404 when unbookmarking non-existent task', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks/99999/unbookmark',
    });

    assert.strictEqual(response.statusCode, 404);
  });
});

describe('Task Comment Operations', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  const createTaskFixture = (overrides = {}) => ({
    title: 'Test Task',
    bodyMd: 'Test task body',
    ...overrides,
  });

  it('should create comment on task (POST /api/tasks/:taskId/comments)', async () => {
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(taskResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/comments`,
      payload: { bodyMd: 'Test comment' },
    });

    assert.strictEqual(response.statusCode, 201);
    const comment = JSON.parse(response.body);
    assert.strictEqual(comment.bodyMd, 'Test comment');
    assert.strictEqual(comment.issueId, task.id);
  });

  it('should return 400 when creating comment with empty body', async () => {
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(taskResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/comments`,
      payload: { bodyMd: '' },
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it('should list comments for task (GET /api/tasks/:taskId/comments)', async () => {
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(taskResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/comments`,
      payload: { bodyMd: 'Comment 1' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/comments`,
      payload: { bodyMd: 'Comment 2' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/tasks/${task.id}/comments`,
    });

    assert.strictEqual(response.statusCode, 200);
    const comments = JSON.parse(response.body);
    assert.strictEqual(comments.length, 2);
  });

  it('should update comment (PATCH /api/tasks/:taskId/comments/:commentId)', async () => {
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(taskResponse.body);

    const commentResponse = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/comments`,
      payload: { bodyMd: 'Original comment' },
    });
    const comment = JSON.parse(commentResponse.body);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}/comments/${comment.id}`,
      payload: { bodyMd: 'Updated comment' },
    });

    assert.strictEqual(response.statusCode, 200);
    const updated = JSON.parse(response.body);
    assert.strictEqual(updated.bodyMd, 'Updated comment');
  });

  it('should delete comment (DELETE /api/tasks/:taskId/comments/:commentId)', async () => {
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(taskResponse.body);

    const commentResponse = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/comments`,
      payload: { bodyMd: 'Comment to delete' },
    });
    const comment = JSON.parse(commentResponse.body);

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/tasks/${task.id}/comments/${comment.id}`,
    });

    assert.strictEqual(response.statusCode, 204);

    // Verify comment list is now empty
    const listResponse = await app.inject({
      method: 'GET',
      url: `/api/tasks/${task.id}/comments`,
    });
    const comments = JSON.parse(listResponse.body);
    assert.strictEqual(comments.length, 0);
  });

  it('should return 404 when creating comment on non-existent task', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks/99999/comments',
      payload: { bodyMd: 'Test comment' },
    });

    assert.strictEqual(response.statusCode, 404);
  });

  it('should return 404 when updating non-existent comment', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/1/comments/99999',
      payload: { bodyMd: 'Updated' },
    });

    assert.strictEqual(response.statusCode, 404);
  });

  it('should return 404 when deleting non-existent comment', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/tasks/1/comments/99999',
    });

    assert.strictEqual(response.statusCode, 404);
  });
});
