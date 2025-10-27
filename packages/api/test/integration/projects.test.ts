import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';

describe('Project Management Operations', () => {
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

  // Helper to create a project for testing
  const createProjectFixture = (overrides = {}) => ({
    name: 'Test Project',
    description: 'Test project description',
    view: 'board' as const,
    ...overrides,
  });

  // Helper to create a task for testing
  const createTaskFixture = (overrides = {}) => ({
    title: 'Test Task',
    bodyMd: 'Test task body',
    ...overrides,
  });

  // Helper to create a memo for testing
  const createMemoFixture = (overrides = {}) => ({
    title: 'Test Memo',
    bodyMd: 'Test memo body',
    ...overrides,
  });

  describe('User Story 1: Create and List Projects', () => {
    it('should create a new project (POST /api/projects)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });

      assert.strictEqual(response.statusCode, 201);
      const project = JSON.parse(response.body);
      assert.strictEqual(project.name, 'Test Project');
      assert.strictEqual(project.description, 'Test project description');
      assert.ok(project.id);
      assert.ok(project.createdAt);
      assert.ok(project.viewMeta);
      assert.strictEqual(project.viewMeta.viewType, 'board');
    });

    it('should create project with minimal data (name only)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Minimal Project' },
      });

      assert.strictEqual(response.statusCode, 201);
      const project = JSON.parse(response.body);
      assert.strictEqual(project.name, 'Minimal Project');
      assert.ok(project.description === null || project.description === '');
      assert.strictEqual(project.viewMeta.viewType, 'board'); // Default view type
    });

    it('should return 400 when creating project without name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { description: 'Project without name' },
      });

      assert.strictEqual(response.statusCode, 400);
    });

    it('should create project with table view', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture({ view: 'table' }),
      });

      assert.strictEqual(response.statusCode, 201);
      const project = JSON.parse(response.body);
      assert.strictEqual(project.viewMeta.viewType, 'table');
    });

    it('should list all projects (GET /api/projects)', async () => {
      // Create two projects
      await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture({ name: 'Project 1' }),
      });
      await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture({ name: 'Project 2' }),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects',
      });

      assert.strictEqual(response.statusCode, 200);
      const projects = JSON.parse(response.body);
      assert.ok(Array.isArray(projects));
      assert.strictEqual(projects.length, 2);
      projects.forEach((project: any) => {
        assert.ok(project.id);
        assert.ok(project.name);
        assert.ok(project.viewMeta);
      });
    });

    it('should return empty array when no projects exist (GET /api/projects)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/projects',
      });

      assert.strictEqual(response.statusCode, 200);
      const projects = JSON.parse(response.body);
      assert.ok(Array.isArray(projects));
      assert.strictEqual(projects.length, 0);
    });
  });

  describe('User Story 2: Add Items to Projects', () => {
    it('should add task to project (POST /api/projects/:id/items)', async () => {
      // Create project
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      // Create task
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture(),
      });
      const task = JSON.parse(taskResponse.body);

      // Add task to project
      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: task.id },
      });

      assert.strictEqual(response.statusCode, 201);
      const projectItem = JSON.parse(response.body);
      assert.strictEqual(projectItem.projectId, project.id);
      assert.strictEqual(projectItem.issueId, task.id);
      assert.ok(projectItem.id);
      assert.ok(projectItem.position);
      assert.ok(projectItem.createdAt);
      assert.ok(projectItem.updatedAt);
    });

    it('should add memo to project', async () => {
      // Create project
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      // Create memo
      const memoResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        payload: createMemoFixture(),
      });
      const memo = JSON.parse(memoResponse.body);

      // Add memo to project
      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: memo.id },
      });

      assert.strictEqual(response.statusCode, 201);
      const projectItem = JSON.parse(response.body);
      assert.strictEqual(projectItem.issueId, memo.id);
    });

    it('should add item with specific position', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture(),
      });
      const task = JSON.parse(taskResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: task.id, position: 5.5 },
      });

      assert.strictEqual(response.statusCode, 201);
      const projectItem = JSON.parse(response.body);
      assert.strictEqual(projectItem.position, 5.5);
    });

    it('should add item with column metadata', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture(),
      });
      const task = JSON.parse(taskResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: task.id, column: 'In Progress' },
      });

      assert.strictEqual(response.statusCode, 201);
      const projectItem = JSON.parse(response.body);
      assert.ok(projectItem.viewMeta);
      assert.strictEqual(projectItem.viewMeta.column, 'In Progress');
    });

    it('should return 404 when adding to non-existent project', async () => {
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture(),
      });
      const task = JSON.parse(taskResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/999999/items',
        payload: { issueId: task.id },
      });

      assert.strictEqual(response.statusCode, 404);
    });

    it('should return 404 when adding non-existent issue', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: 999999 },
      });

      assert.strictEqual(response.statusCode, 404);
    });

    it('should return 409 when adding same issue twice', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture(),
      });
      const task = JSON.parse(taskResponse.body);

      // Add once
      await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: task.id },
      });

      // Try to add again
      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: task.id },
      });

      assert.strictEqual(response.statusCode, 409);
    });
  });

  describe('User Story 3: View Project Details', () => {
    it('should get project by ID with items (GET /api/projects/:id)', async () => {
      // Create project
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      // Create and add task
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture({ title: 'Task in Project' }),
      });
      const task = JSON.parse(taskResponse.body);

      await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: task.id },
      });

      // Get project detail
      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${project.id}`,
      });

      assert.strictEqual(response.statusCode, 200);
      const projectDetail = JSON.parse(response.body);
      assert.strictEqual(projectDetail.id, project.id);
      assert.strictEqual(projectDetail.name, 'Test Project');
      assert.ok(Array.isArray(projectDetail.items));
      assert.strictEqual(projectDetail.items.length, 1);
      assert.strictEqual(projectDetail.items[0].issue.id, task.id);
      assert.strictEqual(projectDetail.items[0].issue.title, 'Task in Project');
      assert.strictEqual(projectDetail.items[0].issue.type, 'task');
    });

    it('should get empty project (no items)', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${project.id}`,
      });

      assert.strictEqual(response.statusCode, 200);
      const projectDetail = JSON.parse(response.body);
      assert.strictEqual(projectDetail.id, project.id);
      assert.ok(Array.isArray(projectDetail.items));
      assert.strictEqual(projectDetail.items.length, 0);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/999999',
      });

      assert.strictEqual(response.statusCode, 404);
    });

    it('should include multiple items with mixed types', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      // Create task and memo
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture({ title: 'Project Task' }),
      });
      const task = JSON.parse(taskResponse.body);

      const memoResponse = await app.inject({
        method: 'POST',
        url: '/api/memos',
        payload: createMemoFixture({ title: 'Project Memo' }),
      });
      const memo = JSON.parse(memoResponse.body);

      // Add both to project
      await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: task.id },
      });
      await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: memo.id },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${project.id}`,
      });

      assert.strictEqual(response.statusCode, 200);
      const projectDetail = JSON.parse(response.body);
      assert.strictEqual(projectDetail.items.length, 2);
      const types = projectDetail.items.map((item: any) => item.issue.type);
      assert.ok(types.includes('task'));
      assert.ok(types.includes('memo'));
    });
  });

  describe('User Story 4: Remove Items and Delete Projects', () => {
    it('should remove item from project (DELETE /api/projects/:id/items/:issueId)', async () => {
      // Create project
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      // Create and add task
      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture(),
      });
      const task = JSON.parse(taskResponse.body);

      await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: task.id },
      });

      // Remove item
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${project.id}/items/${task.id}`,
      });

      assert.strictEqual(response.statusCode, 204);

      // Verify item was removed
      const projectDetail = await app.inject({
        method: 'GET',
        url: `/api/projects/${project.id}`,
      });
      const detail = JSON.parse(projectDetail.body);
      assert.strictEqual(detail.items.length, 0);

      // Verify issue still exists
      const taskCheck = await app.inject({
        method: 'GET',
        url: `/api/tasks/${task.id}`,
      });
      assert.strictEqual(taskCheck.statusCode, 200);
    });

    it('should return 404 when removing from non-existent project', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/projects/999999/items/1',
      });

      assert.strictEqual(response.statusCode, 404);
    });

    it('should return 404 when removing non-existent item', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${project.id}/items/999999`,
      });

      assert.strictEqual(response.statusCode, 404);
    });

    it('should delete project (DELETE /api/projects/:id)', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${project.id}`,
      });

      assert.strictEqual(response.statusCode, 204);

      // Verify project was deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/projects/${project.id}`,
      });
      assert.strictEqual(getResponse.statusCode, 404);
    });

    it('should delete project with items (CASCADE)', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture(),
      });
      const task = JSON.parse(taskResponse.body);

      await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: task.id },
      });

      // Delete project
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${project.id}`,
      });

      assert.strictEqual(response.statusCode, 204);

      // Verify issue still exists
      const taskCheck = await app.inject({
        method: 'GET',
        url: `/api/tasks/${task.id}`,
      });
      assert.strictEqual(taskCheck.statusCode, 200);
    });

    it('should return 404 when deleting non-existent project', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/projects/999999',
      });

      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('User Story 5: Reorder Items in Projects', () => {
    it('should move item to new position (PATCH /api/projects/:id/items/:issueId)', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture(),
      });
      const task = JSON.parse(taskResponse.body);

      await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: task.id },
      });

      // Move to new position
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}/items/${task.id}`,
        payload: { position: 10.5 },
      });

      assert.strictEqual(response.statusCode, 200);
      const updated = JSON.parse(response.body);
      assert.strictEqual(updated.position, 10.5);
    });

    it('should move item to new column', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture(),
      });
      const task = JSON.parse(taskResponse.body);

      await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: task.id, column: 'To Do' },
      });

      // Move to different column
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}/items/${task.id}`,
        payload: { column: 'Done' },
      });

      assert.strictEqual(response.statusCode, 200);
      const updated = JSON.parse(response.body);
      assert.ok(updated.viewMeta);
      assert.strictEqual(updated.viewMeta.column, 'Done');
    });

    it('should move both position and column', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: createTaskFixture(),
      });
      const task = JSON.parse(taskResponse.body);

      await app.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/items`,
        payload: { issueId: task.id },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}/items/${task.id}`,
        payload: { position: 7.5, column: 'In Progress' },
      });

      assert.strictEqual(response.statusCode, 200);
      const updated = JSON.parse(response.body);
      assert.strictEqual(updated.position, 7.5);
      assert.ok(updated.viewMeta);
      assert.strictEqual(updated.viewMeta.column, 'In Progress');
    });

    it('should return 404 when moving item in non-existent project', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/999999/items/1',
        payload: { position: 5 },
      });

      assert.strictEqual(response.statusCode, 404);
    });

    it('should return 404 when moving non-existent item', async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: createProjectFixture(),
      });
      const project = JSON.parse(projectResponse.body);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}/items/999999`,
        payload: { position: 5 },
      });

      assert.strictEqual(response.statusCode, 404);
    });
  });
});
