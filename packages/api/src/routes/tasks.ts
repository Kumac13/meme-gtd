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
  demoteTaskHandler,
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
  TaskListItemSchema,
  TaskDetailSchema,
  TaskIdParamsSchema,
  TaskQuerySchema,
  DemoteTaskRequestSchema,
  DemoteTaskResponseSchema,
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
        summary: 'Create task',
        description: 'Create a new task',
        operationId: 'createTask',
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
        summary: 'List tasks',
        description: 'List all tasks with optional filters',
        operationId: 'listTasks',
        querystring: TaskQuerySchema,
        response: {
          200: z.array(TaskListItemSchema),
          400: ErrorResponseSchema,
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
        summary: 'Get task',
        description: 'Get task by ID',
        operationId: 'getTask',
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
        summary: 'Update task',
        description: 'Update task',
        operationId: 'updateTask',
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
        summary: 'Delete task',
        description: 'Delete task (soft delete)',
        operationId: 'deleteTask',
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
        summary: 'Close task',
        description: 'Close task (set status to done)',
        operationId: 'closeTask',
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
        summary: 'Cancel task',
        description: 'Cancel task (set status to canceled)',
        operationId: 'cancelTask',
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
        summary: 'Reopen task',
        description: 'Reopen task (set status to open)',
        operationId: 'reopenTask',
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
        summary: 'Bookmark task',
        description: 'Bookmark task',
        operationId: 'bookmarkTask',
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
        summary: 'Unbookmark task',
        description: 'Unbookmark task',
        operationId: 'unbookmarkTask',
        params: TaskIdParamsSchema,
        response: {
          200: TaskSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    unbookmarkTaskHandler
  );

  // POST /api/tasks/:id/demote - Demote task to memo
  server.post(
    '/api/tasks/:id/demote',
    {
      schema: {
        tags: ['Tasks'],
        summary: 'Demote task to memo',
        description: 'Copy task content (title, body, comments) to create a new memo. The original task remains unchanged.',
        operationId: 'demoteTask',
        params: TaskIdParamsSchema,
        body: DemoteTaskRequestSchema,
        response: {
          201: DemoteTaskResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    demoteTaskHandler
  );

  // GET /api/tasks/:taskId/comments - List comments
  server.get(
    '/api/tasks/:taskId/comments',
    {
      schema: {
        tags: ['Comments'],
        summary: 'List task comments',
        description: 'List all comments for a task',
        operationId: 'listTaskComments',
        params: TaskCommentParamsSchema,
        response: {
          200: z.array(CommentSchema),
          400: ErrorResponseSchema,
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
        summary: 'Create task comment',
        description: 'Create comment on task',
        operationId: 'createTaskComment',
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
        summary: 'Update task comment',
        description: 'Update comment on task',
        operationId: 'updateTaskComment',
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
        summary: 'Delete task comment',
        description: 'Delete comment from task',
        operationId: 'deleteTaskComment',
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
