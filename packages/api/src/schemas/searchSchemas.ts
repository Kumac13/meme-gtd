import { z } from 'zod';

/**
 * Schema for semantic search query parameters
 */
export const SemanticSearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').describe('Search query text'),
  limit: z.coerce.number().int().positive().max(100).default(20).describe('Maximum number of results to return'),
  types: z.string().optional().describe('Comma-separated issue types to include (memo,task,article)'),
});

export type SemanticSearchQuery = z.infer<typeof SemanticSearchQuerySchema>;

/**
 * Schema for a single search result item
 */
export const SearchResultItemSchema = z.object({
  issue: z.object({
    id: z.number().int().positive().describe('Issue ID'),
    type: z.string().describe('Issue type (memo, task, article)'),
    title: z.string().nullable().describe('Issue title'),
    bodyMd: z.string().describe('Issue body in Markdown'),
    createdAt: z.string().describe('Creation timestamp'),
    updatedAt: z.string().describe('Last update timestamp'),
  }),
  score: z.number().describe('Combined relevance score'),
  vectorScore: z.number().describe('Vector similarity score'),
  matchReason: z.array(z.string()).describe('Reasons for the match'),
});

export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;

/**
 * Schema for semantic search response
 */
export const SemanticSearchResponseSchema = z.object({
  results: z.array(SearchResultItemSchema).describe('Search results sorted by relevance'),
  meta: z.object({
    query: z.string().describe('Original search query'),
    totalResults: z.number().int().nonnegative().describe('Total number of results returned'),
    searchTimeMs: z.number().nonnegative().describe('Search duration in milliseconds'),
  }),
});

export type SemanticSearchResponse = z.infer<typeof SemanticSearchResponseSchema>;
