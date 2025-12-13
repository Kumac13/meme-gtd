import { z } from 'zod';

/**
 * Schema for creating a new article
 */
export const CreateArticleRequestSchema = z.object({
  title: z.string().min(1, 'Article title is required').describe('Article title'),
  bodyMd: z.string().describe('Article content in Markdown format'),
  originalUrl: z.string().url('Must be a valid URL').describe('Original URL of the article'),
  siteName: z.string().nullable().optional().describe('Name of the source site'),
  labels: z.array(z.string()).optional().describe('Array of label names to assign'),
});

export type CreateArticleRequest = z.infer<typeof CreateArticleRequestSchema>;

/**
 * Schema for article query filters
 */
export const ListArticlesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional().describe('Maximum number of articles to return'),
  offset: z.coerce.number().int().nonnegative().optional().describe('Number of articles to skip'),
  search: z.string().optional().describe('Search articles by title or content'),
});

export type ListArticlesQuery = z.infer<typeof ListArticlesQuerySchema>;

/**
 * Schema for article ID params
 */
export const ArticleIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number').describe('Article ID'),
});

export type ArticleIdParams = z.infer<typeof ArticleIdParamsSchema>;

/**
 * Schema for article metadata
 */
export const ArticleMetaSchema = z.object({
  originalUrl: z.string().describe('Original URL of the article'),
  siteName: z.string().nullable().optional().describe('Name of the source site'),
  archivedAt: z.string().describe('Timestamp when the article was archived'),
});

/**
 * Schema for article response
 */
export const ArticleSchema = z.object({
  id: z.number().int().positive().describe('Unique article ID'),
  type: z.literal('article').describe('Issue type (always "article")'),
  title: z.string().describe('Article title'),
  bodyMd: z.string().describe('Article content in Markdown format'),
  meta: ArticleMetaSchema.describe('Article metadata'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
  isBookmarked: z.boolean().describe('Whether the article is bookmarked'),
  isDeleted: z.boolean().describe('Whether the article is soft-deleted'),
  labels: z.array(z.string()).optional().describe('Array of label names assigned to this article'),
  commentCount: z.number().int().nonnegative().optional().describe('Number of comments on this article'),
});

export type Article = z.infer<typeof ArticleSchema>;
