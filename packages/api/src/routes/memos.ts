import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createMemoHandler,
  listMemosHandler,
  getMemoHandler,
  updateMemoHandler,
  deleteMemoHandler,
  promoteMemoHandler,
  bookmarkMemoHandler,
  unbookmarkMemoHandler,
} from '../handlers/memoHandlers.js';
import {
  listMemoCommentsHandler,
  createMemoCommentHandler,
  updateMemoCommentHandler,
  deleteMemoCommentHandler,
} from '../handlers/commentHandlers.js';
import {
  CreateMemoRequestSchema,
  UpdateMemoRequestSchema,
  PromoteMemoRequestSchema,
  MemoSchema,
  MemoDetailSchema,
  MemoIdParamsSchema,
  MemoQuerySchema,
  PaginatedMemoListResponseSchema,
} from '../schemas/memoSchemas.js';
import {
  CreateCommentRequestSchema,
  UpdateCommentRequestSchema,
  CommentSchema,
  MemoCommentParamsSchema,
  MemoCommentIdParamsSchema,
} from '../schemas/commentSchemas.js';
import { TaskSchema } from '../schemas/taskSchemas.js';
import { ErrorResponseSchema } from '../schemas/errorSchemas.js';

/**
 * Register memo routes
 * @param app Fastify instance
 */
export async function memoRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/memos - Create memo
  server.post(
    '/api/memos',
    {
      schema: {
        tags: ['Memos'],
        summary: 'Create memo',
        description: 'Create a new memo',
        operationId: 'createMemo',
        body: CreateMemoRequestSchema,
        response: {
          201: MemoSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    createMemoHandler
  );

  // GET /api/memos - List memos
  server.get(
    '/api/memos',
    {
      schema: {
        tags: ['Memos'],
        summary: 'List memos',
        description: 'List all memos with optional filters and pagination',
        operationId: 'listMemos',
        querystring: MemoQuerySchema,
        response: {
          200: PaginatedMemoListResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    listMemosHandler
  );

  // GET /api/memos/:id - Get memo by ID
  server.get(
    '/api/memos/:id',
    {
      schema: {
        tags: ['Memos'],
        summary: 'Get memo',
        description: 'Get memo by ID',
        operationId: 'getMemo',
        params: MemoIdParamsSchema,
        response: {
          200: MemoDetailSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    getMemoHandler
  );

  // PATCH /api/memos/:id - Update memo
  server.patch(
    '/api/memos/:id',
    {
      schema: {
        tags: ['Memos'],
        summary: 'Update memo',
        description: 'Update memo',
        operationId: 'updateMemo',
        params: MemoIdParamsSchema,
        body: UpdateMemoRequestSchema,
        response: {
          200: MemoSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    updateMemoHandler
  );

  // DELETE /api/memos/:id - Delete memo
  server.delete(
    '/api/memos/:id',
    {
      schema: {
        tags: ['Memos'],
        summary: 'Delete memo',
        description: 'Delete memo (soft delete)',
        operationId: 'deleteMemo',
        params: MemoIdParamsSchema,
        response: {
          204: { type: 'null' },
          404: ErrorResponseSchema,
        },
      },
    },
    deleteMemoHandler
  );

  // POST /api/memos/:id/promote - Promote memo to task
  server.post(
    '/api/memos/:id/promote',
    {
      schema: {
        tags: ['Memos'],
        summary: 'Promote memo to task',
        description: 'Promote memo to task',
        operationId: 'promoteMemo',
        params: MemoIdParamsSchema,
        body: PromoteMemoRequestSchema,
        response: {
          200: TaskSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    promoteMemoHandler
  );

  // POST /api/memos/:id/bookmark - Bookmark memo
  server.post(
    '/api/memos/:id/bookmark',
    {
      schema: {
        tags: ['Memos'],
        summary: 'Bookmark memo',
        description: 'Bookmark memo',
        operationId: 'bookmarkMemo',
        params: MemoIdParamsSchema,
        response: {
          200: MemoSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    bookmarkMemoHandler
  );

  // POST /api/memos/:id/unbookmark - Unbookmark memo
  server.post(
    '/api/memos/:id/unbookmark',
    {
      schema: {
        tags: ['Memos'],
        summary: 'Unbookmark memo',
        description: 'Unbookmark memo',
        operationId: 'unbookmarkMemo',
        params: MemoIdParamsSchema,
        response: {
          200: MemoSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    unbookmarkMemoHandler
  );

  // GET /api/memos/:memoId/comments - List comments
  server.get(
    '/api/memos/:memoId/comments',
    {
      schema: {
        tags: ['Comments'],
        summary: 'List memo comments',
        description: 'List all comments for a memo',
        operationId: 'listMemoComments',
        params: MemoCommentParamsSchema,
        response: {
          200: z.array(CommentSchema),
          400: ErrorResponseSchema,
        },
      },
    },
    listMemoCommentsHandler
  );

  // POST /api/memos/:memoId/comments - Create comment
  server.post(
    '/api/memos/:memoId/comments',
    {
      schema: {
        tags: ['Comments'],
        summary: 'Create memo comment',
        description: 'Create comment on memo',
        operationId: 'createMemoComment',
        params: MemoCommentParamsSchema,
        body: CreateCommentRequestSchema,
        response: {
          201: CommentSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    createMemoCommentHandler
  );

  // PATCH /api/memos/:memoId/comments/:commentId - Update comment
  server.patch(
    '/api/memos/:memoId/comments/:commentId',
    {
      schema: {
        tags: ['Comments'],
        summary: 'Update memo comment',
        description: 'Update comment on memo',
        operationId: 'updateMemoComment',
        params: MemoCommentIdParamsSchema,
        body: UpdateCommentRequestSchema,
        response: {
          200: CommentSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    updateMemoCommentHandler
  );

  // DELETE /api/memos/:memoId/comments/:commentId - Delete comment
  server.delete(
    '/api/memos/:memoId/comments/:commentId',
    {
      schema: {
        tags: ['Comments'],
        summary: 'Delete memo comment',
        description: 'Delete comment from memo',
        operationId: 'deleteMemoComment',
        params: MemoCommentIdParamsSchema,
        response: {
          204: { type: 'null' },
          404: ErrorResponseSchema,
        },
      },
    },
    deleteMemoCommentHandler
  );
}
