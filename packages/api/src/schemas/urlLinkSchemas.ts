import { z } from 'zod';

/**
 * URL Link schema for API responses
 */
export const UrlLinkSchema = z.object({
  id: z.number().int().positive().describe('Unique URL link ID'),
  issueId: z.number().int().positive().describe('Parent issue ID'),
  url: z.string().url().describe('External URL'),
  title: z.string().nullable().describe('Display title'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
});

/**
 * Request schema for creating a URL link
 */
export const CreateUrlLinkRequestSchema = z.object({
  url: z.string().url('Must be a valid URL').describe('External URL'),
  title: z.string().max(200).optional().describe('Display title'),
});

/**
 * Params schema for URL link ID
 */
export const UrlLinkIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'URL link ID must be a number'),
});

/**
 * Params schema for issue ID (for URL links endpoints)
 */
export const IssueIdForUrlLinksParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Issue ID must be a number'),
});

// Export inferred types
export type UrlLink = z.infer<typeof UrlLinkSchema>;
export type CreateUrlLinkRequest = z.infer<typeof CreateUrlLinkRequestSchema>;
