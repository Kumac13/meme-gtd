import { z } from 'zod';

/**
 * Schema for link type values
 */
export const LinkTypeSchema = z.enum(['parent', 'child', 'relates', 'derived_from']);

export type LinkType = z.infer<typeof LinkTypeSchema>;

/**
 * Schema for creating a new link
 */
export const CreateLinkRequestSchema = z.object({
  sourceIssueId: z.number().int().positive().describe('Source issue ID'),
  targetIssueId: z.number().int().positive().describe('Target issue ID'),
  linkType: LinkTypeSchema.describe('Type of relationship between issues'),
});

export type CreateLinkRequest = z.infer<typeof CreateLinkRequestSchema>;

/**
 * Schema for link response
 */
export const LinkSchema = z.object({
  id: z.number().int().positive().describe('Unique link ID'),
  sourceIssueId: z.number().int().positive().describe('Source issue ID'),
  targetIssueId: z.number().int().positive().describe('Target issue ID'),
  linkType: LinkTypeSchema.describe('Type of relationship'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
});

export type Link = z.infer<typeof LinkSchema>;

/**
 * Schema for link with direction and target issue information
 */
export const LinkWithDirectionSchema = LinkSchema.extend({
  direction: z.enum(['outgoing', 'incoming']).describe('Link direction relative to the queried issue'),
  targetIssue: z.object({
    id: z.number().int().positive().describe('Target issue ID'),
    type: z.enum(['task', 'memo']).describe('Target issue type'),
    title: z.string().describe('Target issue title (task title or memo body preview)'),
  }).describe('Information about the target issue in this link'),
});

export type LinkWithDirection = z.infer<typeof LinkWithDirectionSchema>;

/**
 * Schema for link ID params
 */
export const LinkIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Link ID must be a number').describe('Link ID'),
});

export type LinkIdParams = z.infer<typeof LinkIdParamsSchema>;

/**
 * Schema for issue ID params (for listing links)
 */
export const IssueIdForLinksParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Issue ID must be a number').describe('Issue ID'),
});

export type IssueIdForLinksParams = z.infer<typeof IssueIdForLinksParamsSchema>;

/**
 * Schema for list links query parameters
 */
export const ListLinksQuerySchema = z.object({
  type: LinkTypeSchema.optional().describe('Filter by link type'),
});

export type ListLinksQuery = z.infer<typeof ListLinksQuerySchema>;
