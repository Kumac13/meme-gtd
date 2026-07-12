import { z } from 'zod';

/**
 * Schema for creating a new article
 */
export const CreateArticleRequestSchema = z.object({
  title: z.string().min(1, 'Article title is required').describe('Article title'),
  bodyMd: z.string().describe('Article content in Markdown format'),
  originalUrl: z.string().url('Must be a valid URL').optional().describe('Original URL (present for web-saved articles; omit for manual creation)'),
  siteName: z.string().nullable().optional().describe('Name of the source site'),
  labels: z.array(z.string()).optional().describe('Array of label names to assign'),
});

export type CreateArticleRequest = z.infer<typeof CreateArticleRequestSchema>;

/**
 * Schema for updating an article. Only manually created articles
 * (origin='manual') accept updates — web-saved bodies are read-only.
 */
export const UpdateArticleRequestSchema = z.object({
  title: z.string().min(1).optional().describe('Article title'),
  bodyMd: z.string().optional().describe('Article content in Markdown format'),
});

export type UpdateArticleRequest = z.infer<typeof UpdateArticleRequestSchema>;

/**
 * Schema for article query filters (same parameter style as tasks)
 */
export const ListArticlesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional().describe('Maximum number of articles to return'),
  offset: z.coerce.number().int().nonnegative().optional().describe('Number of articles to skip'),
  search: z.string().optional().describe('Search articles by title or content'),
  label: z.string().optional().describe('Filter by label name(s). Supports comma-separated values for OR logic (e.g., wine,book)'),
  projectId: z.string().optional().describe('Filter by project ID(s). Supports comma-separated values for OR logic (e.g., 1,2,3)'),
  bookmarked: z.enum(['true', 'false']).optional().describe('Filter by bookmark status'),
  origin: z.enum(['web', 'manual']).optional().describe('Filter by origin: saved from the web or created manually'),
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
  originalUrl: z.string().optional().describe('Original URL (absent for manually created articles)'),
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
  origin: z.enum(['web', 'manual']).describe('How the article came to be: saved from the web or written by hand (issues.origin)'),
  meta: ArticleMetaSchema.describe('Article metadata'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
  isBookmarked: z.boolean().describe('Whether the article is bookmarked'),
  isDeleted: z.boolean().describe('Whether the article is soft-deleted'),
  labels: z.array(z.string()).optional().describe('Array of label names assigned to this article'),
  commentCount: z.number().int().nonnegative().optional().describe('Number of comments on this article'),
});

export type Article = z.infer<typeof ArticleSchema>;

/**
 * Schema for paginated article list response
 */
export const PaginatedArticleListResponseSchema = z.object({
  data: z.array(ArticleSchema).describe('Array of articles'),
  total: z.number().int().nonnegative().describe('Total count of articles matching the filters (ignoring pagination)'),
  limit: z.number().int().positive().describe('Maximum number of articles returned per page'),
  offset: z.number().int().nonnegative().describe('Number of articles skipped'),
});

export type PaginatedArticleListResponse = z.infer<typeof PaginatedArticleListResponseSchema>;
