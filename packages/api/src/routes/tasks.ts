import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createTaskHandler,
  listTasksHandler,
  getTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
  closeTaskHandler,
  cancelTaskHandler,
  reopenTaskHandler,
  bookmarkTaskHandler,
  unbookmarkTaskHandler,
} from '../handlers/taskHandlers.js';
import {
  listTaskCommentsHandler,
  createTaskCommentHandler,
  updateTaskCommentHandler,
  deleteTaskCommentHandler,
} from '../handlers/commentHandlers.js';
import {
  CreateTaskRequestSchema,
  UpdateTaskRequestSchema,
  TaskSchema,
  TaskDetailSchema,
  TaskIdParamsSchema,
  TaskQuerySchema,
} from '../schemas/taskSchemas.js';
import {
  CreateCommentRequestSchema,
  UpdateCommentRequestSchema,
  CommentSchema,
  TaskCommentParamsSchema,
  TaskCommentIdParamsSchema,
} from '../schemas/commentSchemas.js';
import { ErrorResponseSchema } from '../schemas/errorSchemas.js';

/**
 * Register task routes
 * @param app Fastify instance
 */
export async function taskRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/tasks - Create task
  server.post(
    '/api/tasks',
    {
      schema: {
        tags: ['Tasks'],
        description: 'Create a new task',
        body: CreateTaskRequestSchema,
        response: {
          201: TaskSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    createTaskHandler
  );

  // GET /api/tasks - List tasks
  server.get(
    '/api/tasks',
    {
      schema: {
        tags: ['Tasks'],
        description: 'List all tasks with optional filters',
        querystring: TaskQuerySchema,
        response: {
          200: z.array(TaskSchema),
        },
      },
    },
    listTasksHandler
  );

  // GET /api/tasks/:id - Get task by ID
  server.get(
    '/api/tasks/:id',
    {
      schema: {
        tags: ['Tasks'],
        description: 'Get task by ID',
        params: TaskIdParamsSchema,
        response: {
          200: TaskDetailSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    getTaskHandler
  );

  // PATCH /api/tasks/:id - Update task
  server.patch(
    '/api/tasks/:id',
    {
      schema: {
        tags: ['Tasks'],
        description: 'Update task',
        params: TaskIdParamsSchema,
        body: UpdateTaskRequestSchema,
        response: {
          200: TaskSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    updateTaskHandler
  );

  // DELETE /api/tasks/:id - Delete task
  server.delete(
    '/api/tasks/:id',
    {
      schema: {
        tags: ['Tasks'],
        description: 'Delete task (soft delete)',
        params: TaskIdParamsSchema,
        response: {
          204: { type: 'null' },
          404: ErrorResponseSchema,
        },
      },
    },
    deleteTaskHandler
  );

  // POST /api/tasks/:id/close - Close task
  server.post(
    '/api/tasks/:id/close',
    {
      schema: {
        tags: ['Tasks'],
        description: 'Close task (set status to done)',
        params: TaskIdParamsSchema,
        response: {
          200: TaskSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    closeTaskHandler
  );

  // POST /api/tasks/:id/cancel - Cancel task
  server.post(
    '/api/tasks/:id/cancel',
    {
      schema: {
        tags: ['Tasks'],
        description: 'Cancel task (set status to canceled)',
        params: TaskIdParamsSchema,
        response: {
          200: TaskSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    cancelTaskHandler
  );

  // POST /api/tasks/:id/reopen - Reopen task
  server.post(
    '/api/tasks/:id/reopen',
    {
      schema: {
        tags: ['Tasks'],
        description: 'Reopen task (set status to open)',
        params: TaskIdParamsSchema,
        response: {
          200: TaskSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    reopenTaskHandler
  );

  // POST /api/tasks/:id/bookmark - Bookmark task
  server.post(
    '/api/tasks/:id/bookmark',
    {
      schema: {
        tags: ['Tasks'],
        description: 'Bookmark task',
        params: TaskIdParamsSchema,
        response: {
          200: TaskSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    bookmarkTaskHandler
  );

  // POST /api/tasks/:id/unbookmark - Unbookmark task
  server.post(
    '/api/tasks/:id/unbookmark',
    {
      schema: {
        tags: ['Tasks'],
        description: 'Unbookmark task',
        params: TaskIdParamsSchema,
        response: {
          200: TaskSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    unbookmarkTaskHandler
  );

  // GET /api/tasks/:taskId/comments - List comments
  server.get(
    '/api/tasks/:taskId/comments',
    {
      schema: {
        tags: ['Comments'],
        description: 'List all comments for a task',
        params: TaskCommentParamsSchema,
        response: {
          200: z.array(CommentSchema),
        },
      },
    },
    listTaskCommentsHandler
  );

  // POST /api/tasks/:taskId/comments - Create comment
  server.post(
    '/api/tasks/:taskId/comments',
    {
      schema: {
        tags: ['Comments'],
        description: 'Create comment on task',
        params: TaskCommentParamsSchema,
        body: CreateCommentRequestSchema,
        response: {
          201: CommentSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    createTaskCommentHandler
  );

  // PATCH /api/tasks/:taskId/comments/:commentId - Update comment
  server.patch(
    '/api/tasks/:taskId/comments/:commentId',
    {
      schema: {
        tags: ['Comments'],
        description: 'Update comment on task',
        params: TaskCommentIdParamsSchema,
        body: UpdateCommentRequestSchema,
        response: {
          200: CommentSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    updateTaskCommentHandler
  );

  // DELETE /api/tasks/:taskId/comments/:commentId - Delete comment
  server.delete(
    '/api/tasks/:taskId/comments/:commentId',
    {
      schema: {
        tags: ['Comments'],
        description: 'Delete comment from task',
        params: TaskCommentIdParamsSchema,
        response: {
          204: { type: 'null' },
          404: ErrorResponseSchema,
        },
      },
    },
    deleteTaskCommentHandler
  );
}
