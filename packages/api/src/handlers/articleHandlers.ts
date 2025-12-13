import type { FastifyRequest, FastifyReply } from 'fastify';
import { ArticleService } from 'meme-gtd-core';
import { NotFoundError } from '../errors/index.js';
import type {
  CreateArticleRequest,
  ListArticlesQuery,
} from '../schemas/articleSchemas.js';

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
      siteName,
      labels,
    });
    return reply.status(201).send(article);
  } catch (error) {
    throw error;
  }
}

/**
 * Return a list of articles with optional filter parameters.
 */
export async function listArticlesHandler(
  request: FastifyRequest<{ Querystring: ListArticlesQuery }>,
  reply: FastifyReply
) {
  const articleService = new ArticleService({ db: request.server.db });
  const { limit, offset, search } = request.query;

  try {
    const articles = articleService.list({ limit, offset, search });
    return reply.status(200).send(articles);
  } catch (error) {
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
