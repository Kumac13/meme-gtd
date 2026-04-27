import type { FastifyRequest, FastifyReply } from 'fastify';
import { MemoService } from 'meme-gtd-core';
import { NotFoundError } from '../errors/index.js';
import type {
  CreateMemoRequest,
  UpdateMemoRequest,
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
    const labels = memoService.listLabels(memo.id);
    return reply.status(201).send({ ...memo, labels });
  } catch (error) {
    throw error;
  }
}

/**
 * Default pagination values
 */
const DEFAULT_LIMIT = 100;
const DEFAULT_OFFSET = 0;

/**
 * Return a list of memos with optional filter parameters.
 */
export async function listMemosHandler(
  request: FastifyRequest<{
    Querystring: {
      bookmarked?: string;
      label?: string;
      projectId?: string;
      search?: string;
      createdFrom?: string;
      createdTo?: string;
      limit?: number;
      offset?: number;
    };
  }>,
  reply: FastifyReply
) {
  const memoService = new MemoService({ db: request.server.db });
  const { bookmarked, label, projectId, search, createdFrom, createdTo, limit, offset } = request.query;

  const actualLimit = limit ?? DEFAULT_LIMIT;
  const actualOffset = offset ?? DEFAULT_OFFSET;

  const filters: any = {
    limit: actualLimit,
    offset: actualOffset,
  };
  if (bookmarked === 'true') {
    filters.isBookmarked = true;
  }
  if (label) {
    filters.labels = label.split(',').map(l => l.trim()).filter(Boolean);
  }
  if (projectId) {
    const parts = projectId.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.includes('none')) {
      filters.includeNoProject = true;
    }
    const numericIds = parts
      .filter(s => s !== 'none')
      .map(s => parseInt(s, 10))
      .filter(id => !isNaN(id));
    if (numericIds.length > 0) {
      filters.projectIds = numericIds;
    }
  }
  if (search) {
    filters.search = search;
  }
  if (createdFrom) {
    filters.createdFrom = createdFrom;
  }
  if (createdTo) {
    filters.createdTo = createdTo;
  }

  try {
    const result = memoService.list(filters);
    return reply.status(200).send({
      data: result.data,
      total: result.total,
      limit: actualLimit,
      offset: actualOffset,
    });
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
 * Return the body a task would have if the memo were promoted now,
 * without creating anything. Read-only — safe to call repeatedly.
 */
export async function getPromotePreviewHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const memoId = parseInt(request.params.id, 10);
  const memoService = new MemoService({ db: request.server.db });

  try {
    const preview = memoService.promotePreview(memoId);
    return reply.status(200).send(preview);
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
