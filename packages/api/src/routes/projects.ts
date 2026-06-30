/**
 * Project routes
 * Feature: Issue #19 - Project Management CLI Commands and API
 */

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createProjectHandler,
  listProjectsHandler,
  getProjectHandler,
  updateProjectHandler,
  deleteProjectHandler,
  addProjectItemHandler,
  updateProjectItemHandler,
  removeProjectItemHandler,
  getProjectsForIssueHandler,
} from '../handlers/projectHandlers.js';
import {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  ProjectSchema,
  ProjectDetailSchema,
  ProjectIdParamsSchema,
  AddProjectItemRequestSchema,
  UpdateProjectItemRequestSchema,
  ProjectItemSchema,
  ProjectItemParamsSchema,
} from '../schemas/projectSchemas.js';
import { ErrorResponseSchema } from '../schemas/errorSchemas.js';

/**
 * Register project routes
 * @param app Fastify instance
 */
export async function projectRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/projects - Create a new project
  server.post(
    '/api/projects',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Create project',
        description: 'Create a new project',
        operationId: 'createProject',
        body: CreateProjectRequestSchema,
        response: {
          201: ProjectSchema,
          400: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    createProjectHandler
  );

  // GET /api/projects - List all projects
  server.get(
    '/api/projects',
    {
      schema: {
        tags: ['Projects'],
        summary: 'List projects',
        description: 'List all projects',
        operationId: 'listProjects',
        response: {
          200: z.array(ProjectSchema),
          500: ErrorResponseSchema,
        },
      },
    },
    listProjectsHandler
  );

  // GET /api/projects/:id - Get project details with items
  server.get(
    '/api/projects/:id',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Get project',
        description: 'Get project details with associated items',
        operationId: 'getProject',
        params: ProjectIdParamsSchema,
        response: {
          200: ProjectDetailSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    getProjectHandler
  );

  // PATCH /api/projects/:id - Update project (name, description)
  server.patch(
    '/api/projects/:id',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Update project',
        description: 'Update project name and/or description',
        operationId: 'updateProject',
        params: ProjectIdParamsSchema,
        body: UpdateProjectRequestSchema,
        response: {
          200: ProjectSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    updateProjectHandler
  );

  // DELETE /api/projects/:id - Delete a project
  server.delete(
    '/api/projects/:id',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Delete project',
        description: 'Delete a project (cascades to project items, issues remain intact)',
        operationId: 'deleteProject',
        params: ProjectIdParamsSchema,
        response: {
          204: z.void(),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    deleteProjectHandler
  );

  // POST /api/projects/:id/items - Add item to project
  server.post(
    '/api/projects/:id/items',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Add item to project',
        description: 'Add an issue (task or memo) to a project',
        operationId: 'addProjectItem',
        params: ProjectIdParamsSchema,
        body: AddProjectItemRequestSchema,
        response: {
          201: ProjectItemSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    addProjectItemHandler
  );

  // PATCH /api/projects/:id/items/:issueId - Update project item
  server.patch(
    '/api/projects/:id/items/:issueId',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Update project item',
        description: 'Move item to new position or column',
        operationId: 'updateProjectItem',
        params: ProjectItemParamsSchema,
        body: UpdateProjectItemRequestSchema,
        response: {
          200: ProjectItemSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    updateProjectItemHandler
  );

  // DELETE /api/projects/:id/items/:issueId - Remove item from project
  server.delete(
    '/api/projects/:id/items/:issueId',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Remove item from project',
        description: 'Remove an issue from a project (issue itself remains intact)',
        operationId: 'removeProjectItem',
        params: ProjectItemParamsSchema,
        response: {
          204: z.void(),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    removeProjectItemHandler
  );

  // GET /api/issues/:id/projects - Get projects for an issue
  server.get(
    '/api/issues/:id/projects',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Get projects for issue',
        description: 'Get all projects associated with an issue',
        operationId: 'getProjectsForIssue',
        params: z.object({
          id: z.string().regex(/^\d+$/, 'Issue ID must be numeric'),
        }),
        response: {
          200: z.array(ProjectSchema),
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    getProjectsForIssueHandler
  );
}
