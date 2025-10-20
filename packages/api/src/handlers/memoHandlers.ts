import type { FastifyRequest, FastifyReply } from 'fastify';
import { MemoService, TaskService } from 'meme-gtd-core';
import { NotFoundError } from '../errors/index.js';
import type {
  CreateMemoRequest,
  UpdateMemoRequest,
  PromoteMemoRequest,
} from '../schemas/memoSchemas.js';

/**
 * Create a new memo using the request payload.
 */
export async function createMemoHandler(
  request: FastifyRequest<{ Body: CreateMemoRequest }>,
  reply: FastifyReply
) {
  const { bodyMd } = request.body;
  const memoService = new MemoService({ db: request.server.db });

  try {
    const memo = memoService.create({ bodyMd });
    return reply.status(201).send(memo);
  } catch (error) {
    throw error;
  }
}

/**
 * Return a list of memos with optional filter parameters.
 */
export async function listMemosHandler(
  request: FastifyRequest<{
    Querystring: { bookmarked?: string };
  }>,
  reply: FastifyReply
) {
  const memoService = new MemoService({ db: request.server.db });
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
 * Retrieve a single memo by numeric identifier.
 */
export async function getMemoHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.id, 10);
  const memoService = new MemoService({ db: request.server.db });

  try {
    const memo = memoService.show(memoId);

    if (!memo) {
      throw new NotFoundError('Memo', memoId);
    }

    const labels = memoService.listLabels(memoId);
    return reply.status(200).send({ ...memo, labels });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Memo', memoId);
    }
    throw error;
  }
}

/**
 * Update memo fields based on the provided payload.
 */
export async function updateMemoHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: UpdateMemoRequest;
  }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.id, 10);
  const memoService = new MemoService({ db: request.server.db });

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
 * Soft-delete a memo so it no longer appears in listings.
 */
export async function deleteMemoHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.id, 10);
  const memoService = new MemoService({ db: request.server.db });

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
 * Promote an existing memo to a task.
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
  const memoService = new MemoService({ db: request.server.db });
  const taskService = new TaskService({ db: request.server.db });

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
 * Mark a memo as bookmarked.
 */
export async function bookmarkMemoHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.id, 10);
  const memoService = new MemoService({ db: request.server.db });

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
 * Remove the bookmarked flag from a memo.
 */
export async function unbookmarkMemoHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.id, 10);
  const memoService = new MemoService({ db: request.server.db });

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
