import type { FastifyRequest, FastifyReply } from 'fastify';
import { HighlightService } from 'meme-gtd-core';
import { NotFoundError } from '../errors/index.js';
import type {
  CreateHighlightRequest,
} from '../schemas/highlightSchemas.js';
import type {
  CreateCommentRequest,
  UpdateCommentRequest,
} from '../schemas/commentSchemas.js';

/**
 * List all highlights for an article.
 */
export async function listArticleHighlightsHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const articleId = parseInt(request.params.id, 10);
  const service = new HighlightService({ db: request.server.db });
  const highlights = service.list(articleId);
  return reply.status(200).send(highlights);
}

/**
 * Create a highlight on an article.
 */
export async function createArticleHighlightHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: CreateHighlightRequest }>,
  reply: FastifyReply
) {
  const articleId = parseInt(request.params.id, 10);
  const { exact, prefix, suffix, color } = request.body;
  const service = new HighlightService({ db: request.server.db });

  try {
    const highlight = service.create(articleId, { exact, prefix, suffix, color });
    return reply.status(201).send(highlight);
  } catch (error) {
    // create() calls getArticle, which throws when the id is missing or not an article.
    if (error instanceof Error && (error.message.includes('not found') || error.message.includes('different type'))) {
      throw new NotFoundError('Article', articleId);
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      throw new NotFoundError('Article', articleId);
    }
    throw error;
  }
}

/**
 * Delete a highlight (and soft-delete its comments).
 */
export async function deleteArticleHighlightHandler(
  request: FastifyRequest<{ Params: { id: string; highlightId: string } }>,
  reply: FastifyReply
) {
  const highlightId = parseInt(request.params.highlightId, 10);
  const service = new HighlightService({ db: request.server.db });

  try {
    service.remove(highlightId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Highlight', highlightId);
    }
    throw error;
  }
}

/**
 * List comments on a highlight.
 */
export async function listHighlightCommentsHandler(
  request: FastifyRequest<{ Params: { id: string; highlightId: string } }>,
  reply: FastifyReply
) {
  const highlightId = parseInt(request.params.highlightId, 10);
  const service = new HighlightService({ db: request.server.db });
  const comments = service.listComments(highlightId);
  return reply.status(200).send(comments);
}

/**
 * Create a comment on a highlight.
 */
export async function createHighlightCommentHandler(
  request: FastifyRequest<{ Params: { id: string; highlightId: string }; Body: CreateCommentRequest }>,
  reply: FastifyReply
) {
  const articleId = parseInt(request.params.id, 10);
  const highlightId = parseInt(request.params.highlightId, 10);
  const { bodyMd } = request.body;
  const service = new HighlightService({ db: request.server.db });

  try {
    const comment = service.addComment(articleId, highlightId, bodyMd);
    return reply.status(201).send(comment);
  } catch (error) {
    // FK violation means the article or highlight referenced does not exist.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      throw new NotFoundError('Highlight', highlightId);
    }
    throw error;
  }
}

/**
 * Update a comment on a highlight.
 */
export async function updateHighlightCommentHandler(
  request: FastifyRequest<{ Params: { id: string; highlightId: string; commentId: string }; Body: UpdateCommentRequest }>,
  reply: FastifyReply
) {
  const commentId = parseInt(request.params.commentId, 10);
  const { bodyMd } = request.body;
  const service = new HighlightService({ db: request.server.db });

  try {
    const comment = service.updateComment(commentId, bodyMd);
    return reply.status(200).send(comment);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Comment', commentId);
    }
    throw error;
  }
}

/**
 * Delete a comment from a highlight.
 */
export async function deleteHighlightCommentHandler(
  request: FastifyRequest<{ Params: { id: string; highlightId: string; commentId: string } }>,
  reply: FastifyReply
) {
  const commentId = parseInt(request.params.commentId, 10);
  const service = new HighlightService({ db: request.server.db });

  try {
    service.deleteComment(commentId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Comment', commentId);
    }
    throw error;
  }
}
