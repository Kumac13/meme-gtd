import { z } from 'zod';

/**
 * Schema for creating a highlight on an article.
 *
 * The anchor is a W3C TextQuoteSelector: `exact` is the highlighted text,
 * `prefix`/`suffix` are the surrounding context that disambiguate repeated
 * occurrences. The article body is an immutable snapshot, so the quote alone is
 * a robust anchor (no character offsets).
 */
export const CreateHighlightRequestSchema = z.object({
  exact: z.string().min(1, 'Highlight text cannot be empty').describe('The highlighted text (TextQuoteSelector.exact)'),
  prefix: z.string().optional().describe('Text immediately before the quote (disambiguates repeats)'),
  suffix: z.string().optional().describe('Text immediately after the quote'),
  color: z.string().optional().describe('Highlight color key (defaults to "green")'),
});

export type CreateHighlightRequest = z.infer<typeof CreateHighlightRequestSchema>;

/**
 * Params for highlight endpoints nested under an article.
 */
export const ArticleHighlightsParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Article ID must be a number').describe('Article ID'),
});

export type ArticleHighlightsParams = z.infer<typeof ArticleHighlightsParamsSchema>;

export const HighlightIdParamsSchema = ArticleHighlightsParamsSchema.extend({
  highlightId: z.string().regex(/^\d+$/, 'Highlight ID must be a number').describe('Highlight ID'),
});

export type HighlightIdParams = z.infer<typeof HighlightIdParamsSchema>;

export const HighlightCommentIdParamsSchema = HighlightIdParamsSchema.extend({
  commentId: z.string().regex(/^\d+$/, 'Comment ID must be a number').describe('Comment ID'),
});

export type HighlightCommentIdParams = z.infer<typeof HighlightCommentIdParamsSchema>;

/**
 * Schema for highlight response.
 */
export const HighlightSchema = z.object({
  id: z.number().int().positive().describe('Unique highlight ID'),
  issueId: z.number().int().positive().describe('ID of the article this highlight belongs to'),
  exact: z.string().describe('The highlighted text'),
  prefix: z.string().optional().describe('Context before the quote'),
  suffix: z.string().optional().describe('Context after the quote'),
  color: z.string().describe('Highlight color key'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
  commentCount: z.number().int().nonnegative().optional().describe('Number of comments on this highlight'),
});

export type Highlight = z.infer<typeof HighlightSchema>;

/**
 * Schema for a list of highlights.
 */
export const HighlightListResponseSchema = z.array(HighlightSchema).describe('Array of highlights for an article');
