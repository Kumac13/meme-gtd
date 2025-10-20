import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
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
} from '../schemas/memoSchemas.js';
import {
  CreateCommentRequestSchema,
  UpdateCommentRequestSchema,
  CommentSchema,
} from '../schemas/commentSchemas.js';
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
        description: 'Create a new memo',
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
        description: 'List all memos with optional filters',
        querystring: {
          type: 'object',
          properties: {
            bookmarked: { type: 'string', enum: ['true', 'false'] },
          },
        },
        response: {
          200: {
            type: 'array',
            items: MemoSchema,
          },
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
        description: 'Get memo by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['id'],
        },
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
        description: 'Update memo',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['id'],
        },
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
        description: 'Delete memo (soft delete)',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['id'],
        },
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
        description: 'Promote memo to task',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['id'],
        },
        body: PromoteMemoRequestSchema,
        response: {
          200: {
            type: 'object',
            description: 'Promoted task',
          },
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
        description: 'Bookmark memo',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['id'],
        },
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
        description: 'Unbookmark memo',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['id'],
        },
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
        description: 'List all comments for a memo',
        params: {
          type: 'object',
          properties: {
            memoId: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['memoId'],
        },
        response: {
          200: {
            type: 'array',
            items: CommentSchema,
          },
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
        description: 'Create comment on memo',
        params: {
          type: 'object',
          properties: {
            memoId: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['memoId'],
        },
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
        description: 'Update comment on memo',
        params: {
          type: 'object',
          properties: {
            memoId: { type: 'string', pattern: '^[0-9]+$' },
            commentId: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['memoId', 'commentId'],
        },
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
        description: 'Delete comment from memo',
        params: {
          type: 'object',
          properties: {
            memoId: { type: 'string', pattern: '^[0-9]+$' },
            commentId: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['memoId', 'commentId'],
        },
        response: {
          204: { type: 'null' },
          404: ErrorResponseSchema,
        },
      },
    },
    deleteMemoCommentHandler
  );
}
