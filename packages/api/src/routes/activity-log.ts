import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  getIssueActivityLogHandler,
  getProjectActivityLogHandler,
  getCompletedTasksHandler,
  listActivityLogHandler,
} from '../handlers/activityLogHandlers.js';
import {
  ActivityLogEntrySchema,
  CompletedTaskEntrySchema,
  IssueIdParamsSchema,
  ProjectIdParamsSchema,
  IssueActivityLogQuerySchema,
  ProjectActivityLogQuerySchema,
  CompletedTasksQuerySchema,
  ActivityLogQuerySchema,
} from '../schemas/activityLogSchemas.js';
import { ErrorResponseSchema } from '../schemas/errorSchemas.js';

/**
 * Register activity log routes
 * @param app Fastify instance
 */
export async function activityLogRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // GET /api/activity-log - List activity log entries with filters
  server.get(
    '/api/activity-log',
    {
      schema: {
        tags: ['ActivityLog'],
        summary: 'List activity log entries',
        description: 'List activity log entries with optional filters',
        operationId: 'listActivityLog',
        querystring: ActivityLogQuerySchema,
        response: {
          200: z.array(ActivityLogEntrySchema),
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    listActivityLogHandler
  );

  // GET /api/activity-log/issues/:issueId - Get activity log for an issue
  server.get(
    '/api/activity-log/issues/:issueId',
    {
      schema: {
        tags: ['ActivityLog'],
        summary: 'Get issue activity log',
        description: 'Get activity log entries for a specific issue (task or memo)',
        operationId: 'getIssueActivityLog',
        params: IssueIdParamsSchema,
        querystring: IssueActivityLogQuerySchema,
        response: {
          200: z.array(ActivityLogEntrySchema),
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    getIssueActivityLogHandler
  );

  // GET /api/activity-log/projects/:projectId - Get activity log for a project
  server.get(
    '/api/activity-log/projects/:projectId',
    {
      schema: {
        tags: ['ActivityLog'],
        summary: 'Get project activity log',
        description: 'Get activity log entries for a specific project',
        operationId: 'getProjectActivityLog',
        params: ProjectIdParamsSchema,
        querystring: ProjectActivityLogQuerySchema,
        response: {
          200: z.array(ActivityLogEntrySchema),
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    getProjectActivityLogHandler
  );

  // GET /api/activity-log/completed-tasks - Get completed tasks
  server.get(
    '/api/activity-log/completed-tasks',
    {
      schema: {
        tags: ['ActivityLog'],
        summary: 'Get completed tasks',
        description: 'Get tasks that were completed within a date range',
        operationId: 'getCompletedTasks',
        querystring: CompletedTasksQuerySchema,
        response: {
          200: z.array(CompletedTaskEntrySchema),
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    getCompletedTasksHandler
  );
}
