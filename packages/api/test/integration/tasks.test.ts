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
    assert.strictEqual(task.status, 'inbox'); // Default status changed to inbox
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
    const result = JSON.parse(response.body);
    assert.ok(result.data, 'result.data should exist');
    assert.ok(Array.isArray(result.data));
    assert.strictEqual(result.data.length, 2);
    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.limit, 100);
    assert.strictEqual(result.offset, 0);
    // T018: Assert labels field exists and is an array
    result.data.forEach((task: any) => {
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
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.data[0].status, 'next');
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
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.data[0].isBookmarked, true);
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

  it('should return tasks with projectIds and linkIds arrays (GET /api/tasks)', async () => {
    // Create a task
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task with project and link' }),
    });
    const task = JSON.parse(createResponse.body);

    // Create a project and add the task to it
    const projectResponse = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Test Project', viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    const project = JSON.parse(projectResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/items`,
      payload: { issueId: task.id },
    });

    // Create another task and link it
    const createResponse2 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Related Task' }),
    });
    const relatedTask = JSON.parse(createResponse2.body);

    const linkResponse = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { sourceIssueId: task.id, targetIssueId: relatedTask.id, linkType: 'relates' },
    });
    const link = JSON.parse(linkResponse.body);

    // List tasks and verify projectIds and linkIds
    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    const foundTask = result.data.find((t: any) => t.id === task.id);
    assert.ok(foundTask);
    assert.ok(Array.isArray(foundTask.projectIds), 'projectIds should be an array');
    assert.ok(Array.isArray(foundTask.linkIds), 'linkIds should be an array');
    assert.ok(foundTask.projectIds.includes(project.id), 'projectIds should include the project ID');
    assert.ok(foundTask.linkIds.includes(link.id), 'linkIds should include the link ID');
  });

  it('should return empty projectIds and linkIds arrays when task has no associations', async () => {
    // Create a task without any project or link associations
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Isolated Task' }),
    });
    const task = JSON.parse(createResponse.body);

    // List tasks and verify empty arrays
    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    const foundTask = result.data.find((t: any) => t.id === task.id);
    assert.ok(foundTask);
    assert.ok(Array.isArray(foundTask.projectIds), 'projectIds should be an array');
    assert.ok(Array.isArray(foundTask.linkIds), 'linkIds should be an array');
    assert.strictEqual(foundTask.projectIds.length, 0, 'projectIds should be empty');
    assert.strictEqual(foundTask.linkIds.length, 0, 'linkIds should be empty');
  });

  it('should filter tasks by single projectId (GET /api/tasks?projectId=1)', async () => {
    // Create two tasks
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task in project' }),
    });
    const task1 = JSON.parse(res1.body);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task not in project' }),
    });
    const task2 = JSON.parse(res2.body);

    // Create a project and add task1 only
    const projRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Filter Project', viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    const project = JSON.parse(projRes.body);

    await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/items`,
      payload: { issueId: task1.id },
    });

    // Filter by projectId
    const response = await app.inject({
      method: 'GET',
      url: `/api/tasks?projectId=${project.id}`,
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0].id, task1.id);
  });

  it('should filter tasks by multiple projectIds (GET /api/tasks?projectId=1,2)', async () => {
    // Create three tasks
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task in project A' }),
    });
    const task1 = JSON.parse(res1.body);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task in project B' }),
    });
    const task2 = JSON.parse(res2.body);

    const res3 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task in no project' }),
    });
    const task3 = JSON.parse(res3.body);

    // Create two projects
    const projResA = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Project A', viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    const projectA = JSON.parse(projResA.body);

    const projResB = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Project B', viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    const projectB = JSON.parse(projResB.body);

    // Add task1 to project A, task2 to project B
    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectA.id}/items`,
      payload: { issueId: task1.id },
    });
    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectB.id}/items`,
      payload: { issueId: task2.id },
    });

    // Filter by both projectIds
    const response = await app.inject({
      method: 'GET',
      url: `/api/tasks?projectId=${projectA.id},${projectB.id}`,
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 2);
    const ids = result.data.map((t: any) => t.id);
    assert.ok(ids.includes(task1.id), 'should include task from project A');
    assert.ok(ids.includes(task2.id), 'should include task from project B');
    assert.ok(!ids.includes(task3.id), 'should not include task from no project');
  });

  it('should filter tasks with no project (GET /api/tasks?projectId=none)', async () => {
    // Create two tasks
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task in project' }),
    });
    const task1 = JSON.parse(res1.body);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task with no project' }),
    });
    const task2 = JSON.parse(res2.body);

    // Create a project and add task1 only
    const projRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Some Project', viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    const project = JSON.parse(projRes.body);

    await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/items`,
      payload: { issueId: task1.id },
    });

    // Filter by projectId=none
    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks?projectId=none',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    const ids = result.data.map((t: any) => t.id);
    assert.ok(ids.includes(task2.id), 'should include task with no project');
    assert.ok(!ids.includes(task1.id), 'should not include task in a project');
  });

  it('should filter tasks with no project combined with projectId (GET /api/tasks?projectId=none,{id})', async () => {
    // Create three tasks
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task in project A' }),
    });
    const task1 = JSON.parse(res1.body);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task in project B' }),
    });
    const task2 = JSON.parse(res2.body);

    const res3 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Unassigned task' }),
    });
    const task3 = JSON.parse(res3.body);

    // Create two projects
    const projResA = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Project A', viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    const projectA = JSON.parse(projResA.body);

    const projResB = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Project B', viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    const projectB = JSON.parse(projResB.body);

    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectA.id}/items`,
      payload: { issueId: task1.id },
    });
    await app.inject({
      method: 'POST',
      url: `/api/projects/${projectB.id}/items`,
      payload: { issueId: task2.id },
    });

    // Filter by none + project A
    const response = await app.inject({
      method: 'GET',
      url: `/api/tasks?projectId=none,${projectA.id}`,
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    const ids = result.data.map((t: any) => t.id);
    assert.ok(ids.includes(task1.id), 'should include task from project A');
    assert.ok(ids.includes(task3.id), 'should include unassigned task');
    assert.ok(!ids.includes(task2.id), 'should not include task from project B');
  });

  it('should return empty when projectId=none but all tasks belong to projects', async () => {
    // Create a task and assign it to a project
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task in project' }),
    });
    const task1 = JSON.parse(res1.body);

    const projRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'My Project', viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    const project = JSON.parse(projRes.body);

    await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/items`,
      payload: { issueId: task1.id },
    });

    // Filter by projectId=none
    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks?projectId=none',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 0, 'should return no tasks');
    assert.strictEqual(result.total, 0);
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

  it('should include commentCount field in GET /api/tasks response', async () => {
    // Create task with 3 comments
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task with comments', bodyMd: 'Body content' }),
    });
    assert.strictEqual(createResponse.statusCode, 201);
    const task = JSON.parse(createResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/comments`,
      payload: { bodyMd: 'First comment' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/comments`,
      payload: { bodyMd: 'Second comment' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/comments`,
      payload: { bodyMd: 'Third comment' },
    });

    // List tasks and verify commentCount
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/tasks',
    });
    assert.strictEqual(listResponse.statusCode, 200);
    const result = JSON.parse(listResponse.body);
    const foundTask = result.data.find((t: any) => t.id === task.id);
    assert.ok(foundTask);
    assert.strictEqual(foundTask.commentCount, 3);

    // Create task with 0 comments
    const createResponse2 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task without comments', bodyMd: 'Body' }),
    });
    assert.strictEqual(createResponse2.statusCode, 201);

    // List tasks with status filter and verify commentCount
    const listResponse2 = await app.inject({
      method: 'GET',
      url: '/api/tasks?status=open',
    });
    const result2 = JSON.parse(listResponse2.body);
    result2.data.forEach((t: any) => {
      assert.ok(typeof t.commentCount === 'number');
      assert.ok(t.commentCount >= 0);
    });
  });
});

describe('Task Demote Operations', () => {
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

  it('should demote task to memo (POST /api/tasks/:id/demote)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task to demote', bodyMd: 'Task body content' }),
    });
    const task = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/demote`,
      payload: {},
    });

    assert.strictEqual(response.statusCode, 201);
    const result = JSON.parse(response.body);
    assert.ok(result.task);
    assert.ok(result.memoId);
    assert.strictEqual(result.task.id, task.id);
    assert.strictEqual(result.task.title, 'Task to demote');
    assert.ok(Array.isArray(result.task.labels));
  });

  it('should create memo with auto-generated body from task content', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Demote Me', bodyMd: 'Original body' }),
    });
    const task = JSON.parse(createResponse.body);

    // Add a comment
    await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/comments`,
      payload: { bodyMd: 'A comment on the task' },
    });

    const demoteResponse = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/demote`,
      payload: {},
    });

    assert.strictEqual(demoteResponse.statusCode, 201);
    const result = JSON.parse(demoteResponse.body);

    // Verify memo was created
    const memoResponse = await app.inject({
      method: 'GET',
      url: `/api/memos/${result.memoId}`,
    });
    assert.strictEqual(memoResponse.statusCode, 200);
    const memo = JSON.parse(memoResponse.body);
    assert.ok(memo.bodyMd.includes('Demote Me'));
    assert.ok(memo.bodyMd.includes('Original body'));
    assert.ok(memo.bodyMd.includes('A comment on the task'));
  });

  it('should use custom body when provided', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    const customBody = 'Custom memo body content';
    const demoteResponse = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/demote`,
      payload: { bodyMd: customBody },
    });

    assert.strictEqual(demoteResponse.statusCode, 201);
    const result = JSON.parse(demoteResponse.body);

    const memoResponse = await app.inject({
      method: 'GET',
      url: `/api/memos/${result.memoId}`,
    });
    const memo = JSON.parse(memoResponse.body);
    assert.strictEqual(memo.bodyMd, customBody);
  });

  it('should inherit labels from task', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    // Create and assign labels
    const labelResponse = await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'documentation' },
    });
    const label = JSON.parse(labelResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/issues/${task.id}/labels`,
      payload: { labelId: label.id },
    });

    const demoteResponse = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/demote`,
      payload: {},
    });

    assert.strictEqual(demoteResponse.statusCode, 201);
    const result = JSON.parse(demoteResponse.body);

    const memoResponse = await app.inject({
      method: 'GET',
      url: `/api/memos/${result.memoId}`,
    });
    const memo = JSON.parse(memoResponse.body);
    assert.ok(memo.labels.includes('documentation'));
  });

  it('should use custom labels when provided', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    const demoteResponse = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/demote`,
      payload: { labels: ['archive', 'notes'] },
    });

    assert.strictEqual(demoteResponse.statusCode, 201);
    const result = JSON.parse(demoteResponse.body);

    const memoResponse = await app.inject({
      method: 'GET',
      url: `/api/memos/${result.memoId}`,
    });
    const memo = JSON.parse(memoResponse.body);
    assert.ok(memo.labels.includes('archive'));
    assert.ok(memo.labels.includes('notes'));
  });

  it('should create derived_from link between memo and task', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    const demoteResponse = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/demote`,
      payload: {},
    });

    assert.strictEqual(demoteResponse.statusCode, 201);
    const result = JSON.parse(demoteResponse.body);

    // Check links from memo
    const linksResponse = await app.inject({
      method: 'GET',
      url: `/api/issues/${result.memoId}/links`,
    });
    assert.strictEqual(linksResponse.statusCode, 200);
    const links = JSON.parse(linksResponse.body);
    const derivedFromLink = links.find((l: any) => l.linkType === 'derived_from' && l.targetIssueId === task.id);
    assert.ok(derivedFromLink);
  });

  it('should keep original task unchanged', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Original Title', bodyMd: 'Original Body', status: 'next' }),
    });
    const originalTask = JSON.parse(createResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/tasks/${originalTask.id}/demote`,
      payload: {},
    });

    // Verify task is unchanged
    const taskResponse = await app.inject({
      method: 'GET',
      url: `/api/tasks/${originalTask.id}`,
    });
    assert.strictEqual(taskResponse.statusCode, 200);
    const task = JSON.parse(taskResponse.body);
    assert.strictEqual(task.title, 'Original Title');
    assert.strictEqual(task.bodyMd, 'Original Body');
    assert.strictEqual(task.status, 'next');
  });

  it('should copy existing links from task to memo', async () => {
    // Create task to demote
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task with links' }),
    });
    const task = JSON.parse(taskResponse.body);

    // Create another task to link to
    const relatedTaskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Related task' }),
    });
    const relatedTask = JSON.parse(relatedTaskResponse.body);

    // Create a "relates" link from task to relatedTask
    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: task.id,
        targetIssueId: relatedTask.id,
        linkType: 'relates',
      },
    });

    // Demote the task
    const demoteResponse = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/demote`,
      payload: {},
    });

    assert.strictEqual(demoteResponse.statusCode, 201);
    const result = JSON.parse(demoteResponse.body);

    // Verify links were copied to memo
    const linksResponse = await app.inject({
      method: 'GET',
      url: `/api/issues/${result.memoId}/links`,
    });
    assert.strictEqual(linksResponse.statusCode, 200);
    const links = JSON.parse(linksResponse.body);

    // Should have derived_from link AND the relates link
    const derivedFromLink = links.find((l: any) => l.linkType === 'derived_from' && l.targetIssueId === task.id);
    assert.ok(derivedFromLink, 'Should have derived_from link to original task');

    const relatesLink = links.find((l: any) => l.linkType === 'relates' && l.targetIssueId === relatedTask.id);
    assert.ok(relatesLink, 'Should have copied relates link to related task');
  });

  it('should copy incoming links to memo', async () => {
    // Create task to demote
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'Task with incoming link' }),
    });
    const task = JSON.parse(taskResponse.body);

    // Create a memo that links to the task
    const memoResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'A memo linking to task' },
    });
    const sourceMemo = JSON.parse(memoResponse.body);

    // Create an incoming link: sourceMemo -> task (relates)
    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: {
        sourceIssueId: sourceMemo.id,
        targetIssueId: task.id,
        linkType: 'relates',
      },
    });

    // Demote the task
    const demoteResponse = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/demote`,
      payload: {},
    });

    assert.strictEqual(demoteResponse.statusCode, 201);
    const result = JSON.parse(demoteResponse.body);

    // Verify incoming link was copied
    const linksResponse = await app.inject({
      method: 'GET',
      url: `/api/issues/${result.memoId}/links`,
    });
    const links = JSON.parse(linksResponse.body);

    // The incoming link should now point to the new memo
    const copiedLink = links.find((l: any) => l.linkType === 'relates' && l.sourceIssueId === sourceMemo.id);
    assert.ok(copiedLink, 'Should have copied incoming relates link from source memo');
  });

  it('should return 404 when demoting non-existent task', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks/99999/demote',
      payload: {},
    });

    assert.strictEqual(response.statusCode, 404);
  });
});

// ============================================================
// Phase 3: Calendar Datetime Separation API Tests (T013-T015)
// New fields: scheduledStart, scheduledEnd, isAllDay, actualStart, actualEnd
// ============================================================

describe('Task Datetime Fields Operations', () => {
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

  // T013: POST /api/tasks with scheduledStart/scheduledEnd returns task with new fields
  it('should create task with scheduledStart and scheduledEnd (POST /api/tasks)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({
        title: 'Scheduled Task',
        scheduledStart: '2025-12-07T10:00:00',
        scheduledEnd: '2025-12-07T11:00:00',
      }),
    });

    assert.strictEqual(response.statusCode, 201);
    const task = JSON.parse(response.body);
    assert.strictEqual(task.scheduledStart, '2025-12-07T10:00:00');
    assert.strictEqual(task.scheduledEnd, '2025-12-07T11:00:00');
    assert.strictEqual(task.isAllDay, false);
  });

  it('should create task with isAllDay=true (POST /api/tasks)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({
        title: 'All Day Event',
        scheduledStart: '2025-12-07T00:00:00',
        scheduledEnd: '2025-12-09T23:59:59',
        isAllDay: true,
      }),
    });

    assert.strictEqual(response.statusCode, 201);
    const task = JSON.parse(response.body);
    assert.strictEqual(task.scheduledStart, '2025-12-07T00:00:00');
    assert.strictEqual(task.scheduledEnd, '2025-12-09T23:59:59');
    assert.strictEqual(task.isAllDay, true);
  });

  it('should create task without scheduling fields and return null values', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ title: 'No Schedule' }),
    });

    assert.strictEqual(response.statusCode, 201);
    const task = JSON.parse(response.body);
    assert.strictEqual(task.scheduledStart, null);
    assert.strictEqual(task.scheduledEnd, null);
    assert.strictEqual(task.isAllDay, false);
    assert.strictEqual(task.actualStart, null);
    assert.strictEqual(task.actualEnd, null);
  });

  // T014: PATCH /api/tasks/{id} with scheduledStart/scheduledEnd updates correctly
  it('should update task with scheduledStart and scheduledEnd (PATCH /api/tasks/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      payload: {
        scheduledStart: '2025-12-08T09:00:00',
        scheduledEnd: '2025-12-08T10:30:00',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const updated = JSON.parse(response.body);
    assert.strictEqual(updated.scheduledStart, '2025-12-08T09:00:00');
    assert.strictEqual(updated.scheduledEnd, '2025-12-08T10:30:00');
  });

  it('should update task isAllDay toggle (PATCH /api/tasks/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({ isAllDay: false }),
    });
    const task = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      payload: {
        isAllDay: true,
        scheduledStart: '2025-12-08T00:00:00',
        scheduledEnd: '2025-12-10T23:59:59',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const updated = JSON.parse(response.body);
    assert.strictEqual(updated.isAllDay, true);
  });

  it('should update task with actualStart and actualEnd for manual override (PATCH /api/tasks/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture(),
    });
    const task = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      payload: {
        actualStart: '2025-12-07T16:00:00',
        actualEnd: '2025-12-07T17:30:00',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const updated = JSON.parse(response.body);
    assert.strictEqual(updated.actualStart, '2025-12-07T16:00:00');
    assert.strictEqual(updated.actualEnd, '2025-12-07T17:30:00');
  });

  it('should clear scheduledStart with null (PATCH /api/tasks/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({
        scheduledStart: '2025-12-07T10:00:00',
        scheduledEnd: '2025-12-07T11:00:00',
      }),
    });
    const task = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      payload: {
        scheduledStart: null,
        scheduledEnd: null,
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const updated = JSON.parse(response.body);
    assert.strictEqual(updated.scheduledStart, null);
    assert.strictEqual(updated.scheduledEnd, null);
  });

  // T015: GET /api/tasks returns tasks with new datetime fields
  it('should return tasks with new datetime fields (GET /api/tasks)', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({
        title: 'Task with schedule',
        scheduledStart: '2025-12-07T14:00:00',
        scheduledEnd: '2025-12-07T15:00:00',
      }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.data[0].scheduledStart, '2025-12-07T14:00:00');
    assert.strictEqual(result.data[0].scheduledEnd, '2025-12-07T15:00:00');
    assert.strictEqual(result.data[0].isAllDay, false);
  });

  it('should return task by ID with new datetime fields (GET /api/tasks/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: createTaskFixture({
        title: 'Task with schedule',
        scheduledStart: '2025-12-07T14:00:00',
        scheduledEnd: '2025-12-07T15:00:00',
        isAllDay: false,
      }),
    });
    const created = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/tasks/${created.id}`,
    });

    assert.strictEqual(response.statusCode, 200);
    const task = JSON.parse(response.body);
    assert.strictEqual(task.scheduledStart, '2025-12-07T14:00:00');
    assert.strictEqual(task.scheduledEnd, '2025-12-07T15:00:00');
    assert.strictEqual(task.isAllDay, false);
    assert.strictEqual(task.actualStart, null);
    assert.strictEqual(task.actualEnd, null);
  });
});

// ============================================================
// Task Kind Operations (T1-1 to T1-7)
// New field: taskKind = 'event' | 'action'
// ============================================================

describe('Task Kind Operations', () => {
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

  // T1-1: taskKind='event'でタスクを作成できる
  it('should create task with taskKind=event', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Team meeting', taskKind: 'event' },
    });
    assert.strictEqual(response.statusCode, 201);
    const task = JSON.parse(response.body);
    assert.strictEqual(task.taskKind, 'event');
  });

  // T1-2: taskKind='action'でタスクを作成できる
  it('should create task with taskKind=action', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Review PR', taskKind: 'action' },
    });
    assert.strictEqual(response.statusCode, 201);
    const task = JSON.parse(response.body);
    assert.strictEqual(task.taskKind, 'action');
  });

  // T1-3: taskKind未指定時はデフォルトで'action'になる
  it('should default taskKind to action when not specified', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Regular task' },
    });
    assert.strictEqual(response.statusCode, 201);
    const task = JSON.parse(response.body);
    assert.strictEqual(task.taskKind, 'action');
  });

  // T1-4: PATCHでtaskKindを変更できる
  it('should update taskKind via PATCH', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Task to update' },
    });
    const task = JSON.parse(createRes.body);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      payload: { taskKind: 'event' },
    });
    assert.strictEqual(response.statusCode, 200);
    const updated = JSON.parse(response.body);
    assert.strictEqual(updated.taskKind, 'event');
  });

  // T1-5: 不正なtaskKind値は400エラー
  it('should reject invalid taskKind value', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Invalid', taskKind: 'invalid' },
    });
    assert.strictEqual(response.statusCode, 400);
  });

  // T1-6: GET /api/tasksでtaskKindが返る
  it('should return taskKind in GET /api/tasks', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Event task', taskKind: 'event' },
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks',
    });
    const result = JSON.parse(response.body);
    assert.ok(result.data.some((t: any) => t.taskKind === 'event'));
  });

  // T1-7: GET /api/tasks/:idでtaskKindが返る
  it('should return taskKind in GET /api/tasks/:id', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Single task', taskKind: 'event' },
    });
    const task = JSON.parse(createRes.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/tasks/${task.id}`,
    });
    const fetched = JSON.parse(response.body);
    assert.strictEqual(fetched.taskKind, 'event');
  });
});
