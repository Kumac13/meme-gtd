import type { FastifyRequest, FastifyReply } from 'fastify';
import { MemoService, TaskService } from 'meme-gtd-core';
import { NotFoundError } from '../errors/index.js';
import type {
  CreateMemoRequest,
  UpdateMemoRequest,
  PromoteMemoRequest,
} from '../schemas/memoSchemas.js';

/**
 * Create a new memo
 */
export async function createMemoHandler(
  request: FastifyRequest<{ Body: CreateMemoRequest }>,
  reply: FastifyReply
) {
  const { bodyMd } = request.body;
  const memoService = new MemoService({ config: request.server.config });

  try {
    const memo = memoService.create({ bodyMd });
    return reply.status(201).send(memo);
  } catch (error) {
    throw error;
  }
}

/**
 * List all memos with optional filters
 */
export async function listMemosHandler(
  request: FastifyRequest<{
    Querystring: { bookmarked?: string };
  }>,
  reply: FastifyReply
) {
  const memoService = new MemoService({ config: request.server.config });
  const { bookmarked } = request.query;

  const filters = bookmarked === 'true' ? { isBookmarked: true } : {};

  try {
    const memos = memoService.list(filters);
    return reply.status(200).send(memos);
  } catch (error) {
    throw error;
  }
}

/**
 * Get a memo by ID
 */
export async function getMemoHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.id, 10);
  const memoService = new MemoService({ config: request.server.config });

  try {
    const memo = memoService.show(memoId);

    if (!memo) {
      throw new NotFoundError('Memo', memoId);
    }

    return reply.status(200).send(memo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Memo', memoId);
    }
    throw error;
  }
}

/**
 * Update a memo
 */
export async function updateMemoHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: UpdateMemoRequest;
  }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.id, 10);
  const memoService = new MemoService({ config: request.server.config });

  try {
    const memo = memoService.edit({
      id: memoId,
      ...request.body,
    });

    return reply.status(200).send(memo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Memo', memoId);
    }
    throw error;
  }
}

/**
 * Delete a memo (soft delete)
 */
export async function deleteMemoHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.id, 10);
  const memoService = new MemoService({ config: request.server.config });

  try {
    memoService.remove(memoId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Memo', memoId);
    }
    throw error;
  }
}

/**
 * Promote a memo to a task
 */
export async function promoteMemoHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: PromoteMemoRequest;
  }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.id, 10);
  const { title, status = 'open' } = request.body;
  const memoService = new MemoService({ config: request.server.config });
  const taskService = new TaskService({ config: request.server.config });

  try {
    const { taskId } = memoService.promote({
      memoId,
      title,
      status,
    });

    const task = taskService.show(taskId);
    return reply.status(200).send(task);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Memo', memoId);
    }
    throw error;
  }
}

/**
 * Bookmark a memo
 */
export async function bookmarkMemoHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.id, 10);
  const memoService = new MemoService({ config: request.server.config });

  try {
    memoService.setBookmark(memoId, true);
    const memo = memoService.show(memoId);
    return reply.status(200).send(memo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Memo', memoId);
    }
    throw error;
  }
}

/**
 * Unbookmark a memo
 */
export async function unbookmarkMemoHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.id, 10);
  const memoService = new MemoService({ config: request.server.config });

  try {
    memoService.setBookmark(memoId, false);
    const memo = memoService.show(memoId);
    return reply.status(200).send(memo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Memo', memoId);
    }
    throw error;
  }
}
