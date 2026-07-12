import type { FastifyRequest, FastifyReply } from 'fastify';
import { ArticleService } from 'meme-gtd-core';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type {
  CreateArticleRequest,
  UpdateArticleRequest,
  ListArticlesQuery,
} from '../schemas/articleSchemas.js';
import type { CreateCommentRequest, UpdateCommentRequest } from '../schemas/commentSchemas.js';

/**
 * Create a new article using the request payload.
 */
export async function createArticleHandler(
  request: FastifyRequest<{ Body: CreateArticleRequest }>,
  reply: FastifyReply
) {
  const { title, bodyMd, originalUrl, siteName, labels } = request.body;
  const articleService = new ArticleService({ db: request.server.db });

  try {
    const article = articleService.create({
      title,
      bodyMd,
      originalUrl,
      siteName: siteName ?? undefined,
      labels,
    });
    return reply.status(201).send(article);
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
 * Return a list of articles with optional filter parameters.
 */
export async function listArticlesHandler(
  request: FastifyRequest<{ Querystring: ListArticlesQuery }>,
  reply: FastifyReply
) {
  const articleService = new ArticleService({ db: request.server.db });
  const { limit, offset, search, label, projectId, bookmarked, origin } = request.query;

  const actualLimit = limit ?? DEFAULT_LIMIT;
  const actualOffset = offset ?? DEFAULT_OFFSET;

  // Same comma-separated parameter semantics as tasks (label / projectId,
  // with "none" meaning articles not assigned to any project).
  const labels = label ? label.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  let projectIds: number[] | undefined;
  let includeNoProject: boolean | undefined;
  if (projectId) {
    const parts = projectId.split(',').map((s) => s.trim()).filter(Boolean);
    includeNoProject = parts.includes('none') || undefined;
    const ids = parts.filter((p) => p !== 'none').map((p) => Number(p));
    if (ids.some((n) => !Number.isInteger(n) || n <= 0)) {
      throw new ValidationError('projectId must be a comma-separated list of positive integers or "none"');
    }
    projectIds = ids.length > 0 ? ids : undefined;
  }

  try {
    const result = articleService.list({
      limit: actualLimit,
      offset: actualOffset,
      search,
      labels,
      projectIds,
      includeNoProject,
      isBookmarked: bookmarked === 'true' ? true : undefined,
      origin,
    });
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
 * Update a manually created article (web-saved bodies are read-only; the
 * rule is enforced in core and surfaced here as a 400).
 */
export async function updateArticleHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateArticleRequest }>,
  reply: FastifyReply
) {
  const articleId = parseInt(request.params.id, 10);
  const articleService = new ArticleService({ db: request.server.db });
  try {
    const article = articleService.update(articleId, request.body);
    return reply.status(200).send(article);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Article', articleId);
    }
    if (error instanceof Error && error.message.includes('read-only')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}

export async function bookmarkArticleHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const articleId = parseInt(request.params.id, 10);
  const articleService = new ArticleService({ db: request.server.db });
  try {
    return reply.status(200).send(articleService.setBookmark(articleId, true));
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Article', articleId);
    }
    throw error;
  }
}

export async function unbookmarkArticleHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const articleId = parseInt(request.params.id, 10);
  const articleService = new ArticleService({ db: request.server.db });
  try {
    return reply.status(200).send(articleService.setBookmark(articleId, false));
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Article', articleId);
    }
    throw error;
  }
}

export async function listArticleCommentsHandler(
  request: FastifyRequest<{ Params: { articleId: string } }>,
  reply: FastifyReply
) {
  const articleId = parseInt(request.params.articleId, 10);
  const articleService = new ArticleService({ db: request.server.db });
  try {
    return reply.status(200).send(articleService.listComments(articleId));
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Article', articleId);
    }
    throw error;
  }
}

export async function createArticleCommentHandler(
  request: FastifyRequest<{ Params: { articleId: string }; Body: CreateCommentRequest }>,
  reply: FastifyReply
) {
  const articleId = parseInt(request.params.articleId, 10);
  const articleService = new ArticleService({ db: request.server.db });
  try {
    const comment = articleService.addComment(articleId, request.body.bodyMd);
    return reply.status(201).send(comment);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Article', articleId);
    }
    throw error;
  }
}

export async function updateArticleCommentHandler(
  request: FastifyRequest<{ Params: { articleId: string; commentId: string }; Body: UpdateCommentRequest }>,
  reply: FastifyReply
) {
  const commentId = parseInt(request.params.commentId, 10);
  const articleService = new ArticleService({ db: request.server.db });
  try {
    return reply.status(200).send(articleService.updateComment(commentId, request.body.bodyMd));
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Comment', commentId);
    }
    throw error;
  }
}

export async function deleteArticleCommentHandler(
  request: FastifyRequest<{ Params: { articleId: string; commentId: string } }>,
  reply: FastifyReply
) {
  const commentId = parseInt(request.params.commentId, 10);
  const articleService = new ArticleService({ db: request.server.db });
  try {
    articleService.deleteComment(commentId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Comment', commentId);
    }
    throw error;
  }
}

/**
 * Retrieve a single article by numeric identifier.
 */
export async function getArticleHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const articleId = parseInt(request.params.id, 10);
  const articleService = new ArticleService({ db: request.server.db });

  try {
    const article = articleService.get(articleId);
    return reply.status(200).send(article);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Article', articleId);
    }
    throw error;
  }
}

/**
 * Soft-delete an article so it no longer appears in listings.
 */
export async function deleteArticleHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const articleId = parseInt(request.params.id, 10);
  const articleService = new ArticleService({ db: request.server.db });

  try {
    articleService.remove(articleId);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Article', articleId);
    }
    throw error;
  }
}
