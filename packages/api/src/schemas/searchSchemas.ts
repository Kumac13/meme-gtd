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
    status: z.string().nullable().describe('Issue status'),
    isBookmarked: z.boolean().describe('Whether the issue is bookmarked'),
    labels: z.array(z.string()).describe('Labels assigned to the issue'),
    commentCount: z.number().int().nonnegative().describe('Number of comments'),
    taskKind: z.string().nullable().describe('Task kind (action, waiting, etc.)'),
    scheduledOn: z.string().nullable().describe('Scheduled date'),
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

/**
 * Schema for keyword search query parameters
 */
export const KeywordSearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').describe('Search query text'),
  limit: z.coerce.number().int().positive().max(100).default(20).describe('Maximum number of results to return'),
  offset: z.coerce.number().int().nonnegative().default(0).describe('Pagination offset'),
  types: z.string().optional().describe('Comma-separated issue types to include (memo,task,article)'),
  status: z.string().optional().describe('Filter by issue status (e.g., open, done)'),
  label: z.string().optional().describe('Filter by label names (comma-separated, OR logic)'),
  bookmarked: z.string().optional().describe('Filter by bookmarked status (set to "true" to show only bookmarked)'),
  order: z.enum(['asc', 'desc']).default('desc').describe('Sort order by updated_at'),
});

export type KeywordSearchQuery = z.infer<typeof KeywordSearchQuerySchema>;

export const KeywordMatchSchema = z.object({
  field: z.enum(['issue', 'comment']).describe('Where the match was found'),
  commentId: z.number().int().nullable().describe('Comment ID if match is in a comment'),
  text: z.string().describe('Matched text'),
});

export const KeywordSearchResultItemSchema = z.object({
  id: z.number().int().positive().describe('Issue ID'),
  type: z.string().describe('Issue type (memo, task, article)'),
  title: z.string().nullable().describe('Issue title'),
  bodyMd: z.string().describe('Issue body in Markdown'),
  status: z.string().nullable().describe('Issue status'),
  isBookmarked: z.boolean().describe('Whether the issue is bookmarked'),
  labels: z.array(z.string()).describe('Labels assigned to the issue'),
  commentCount: z.number().int().nonnegative().describe('Number of comments'),
  createdAt: z.string().describe('Creation timestamp'),
  updatedAt: z.string().describe('Last update timestamp'),
  matches: z.array(KeywordMatchSchema).describe('Match details'),
});

export const KeywordSearchResponseSchema = z.object({
  results: z.array(KeywordSearchResultItemSchema).describe('Search results grouped by issue'),
  total: z.number().int().nonnegative().describe('Total number of results'),
  limit: z.number().int().positive().describe('Page size'),
  offset: z.number().int().nonnegative().describe('Current offset'),
});

export type KeywordSearchResponse = z.infer<typeof KeywordSearchResponseSchema>;

/**
 * Schema for the search export request body.
 * Clients pass the currently displayed item IDs together with the filters used
 * to produce them. The server logs an activity_log entry and returns a JSON
 * payload suitable for copying to clipboard.
 */
export const SearchExportFiltersSchema = z
  .object({
    query: z.string().optional().describe('Free-text search query'),
    searchMode: z.enum(['keyword', 'semantic']).optional().describe('Search mode used'),
    labels: z.array(z.string()).optional().describe('Labels filter (OR)'),
    dateFrom: z.string().optional().describe('Start of date range filter'),
    dateTo: z.string().optional().describe('End of date range filter'),
    bookmarked: z.boolean().optional().describe('Whether bookmark-only filter is on'),
    projectIds: z.array(z.number().int()).optional().describe('Project IDs filter'),
    includeNoProject: z.boolean().optional().describe('Include items without project'),
    status: z.string().optional().describe('Task status filter'),
  })
  .describe('Filters currently applied to the list view');

export const SearchExportRequestSchema = z.object({
  type: z.enum(['memos', 'tasks', 'articles']).describe('Issue type being exported'),
  filters: SearchExportFiltersSchema,
  itemIds: z.array(z.number().int().positive()).describe('IDs of items to include (current page or loaded range). Ignored when scope="all".'),
  scope: z
    .enum(['loaded', 'all'])
    .default('loaded')
    .describe(
      'Export scope. "loaded" (default) exports exactly the provided itemIds — the current page / loaded range. "all" ignores itemIds and exports every item matching filters, resolved server-side with no pagination. Semantic search (filters.searchMode="semantic") always behaves as "loaded" because its result set is an inherently bounded top-K ranking.'
    ),
  matchedComments: z
    .record(z.string(), z.string())
    .optional()
    .describe('Matched comment snippets keyed by item id (from keyword search)'),
  matchedScores: z
    .record(z.string(), z.number())
    .optional()
    .describe('Semantic search relevance scores keyed by item id (0-1)'),
  includeComments: z.boolean().default(false).describe('Whether to include full comments for each item'),
});

export type SearchExportRequest = z.infer<typeof SearchExportRequestSchema>;

const SearchExportCommentSchema = z.object({
  id: z.number().int().positive(),
  bodyMd: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const SearchExportMemoResultSchema = z.object({
  id: z.number().int().positive(),
  type: z.literal('memo'),
  bodyMd: z.string(),
  labels: z.array(z.string()),
  isBookmarked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  matchedComment: z.string().optional(),
  matchedScore: z.number().optional(),
  comments: z.array(SearchExportCommentSchema).optional(),
});

const SearchExportTaskResultSchema = z.object({
  id: z.number().int().positive(),
  type: z.literal('task'),
  title: z.string().nullable(),
  bodyMd: z.string(),
  status: z.string().nullable(),
  scheduledOn: z.string().nullable(),
  labels: z.array(z.string()),
  isBookmarked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  matchedComment: z.string().optional(),
  matchedScore: z.number().optional(),
  comments: z.array(SearchExportCommentSchema).optional(),
});

const SearchExportArticleResultSchema = z.object({
  id: z.number().int().positive(),
  type: z.literal('article'),
  title: z.string().nullable(),
  url: z.string().nullable(),
  bodyMd: z.string(),
  labels: z.array(z.string()),
  isBookmarked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  matchedComment: z.string().optional(),
  matchedScore: z.number().optional(),
  comments: z.array(SearchExportCommentSchema).optional(),
});

export const SearchExportResponseSchema = z.object({
  type: z.enum(['memos', 'tasks', 'articles']),
  total: z.number().int().nonnegative(),
  truncated: z
    .boolean()
    .default(false)
    .describe(
      'True when scope="all" matched more items than the export cap and the returned results were truncated to the cap.'
    ),
  filters: SearchExportFiltersSchema,
  results: z.array(
    z.union([
      SearchExportMemoResultSchema,
      SearchExportTaskResultSchema,
      SearchExportArticleResultSchema,
    ])
  ),
});

export type SearchExportResponse = z.infer<typeof SearchExportResponseSchema>;
