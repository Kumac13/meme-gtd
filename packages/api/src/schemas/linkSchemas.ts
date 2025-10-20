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
  sourceIssueId: z.number().int().positive(),
  targetIssueId: z.number().int().positive(),
  linkType: LinkTypeSchema,
});

export type CreateLinkRequest = z.infer<typeof CreateLinkRequestSchema>;

/**
 * Schema for link response
 */
export const LinkSchema = z.object({
  id: z.number().int().positive(),
  sourceIssueId: z.number().int().positive(),
  targetIssueId: z.number().int().positive(),
  linkType: LinkTypeSchema,
  createdAt: z.string().datetime(),
});

export type Link = z.infer<typeof LinkSchema>;

/**
 * Schema for link with direction information
 */
export const LinkWithDirectionSchema = LinkSchema.extend({
  direction: z.enum(['outgoing', 'incoming']),
});

export type LinkWithDirection = z.infer<typeof LinkWithDirectionSchema>;

/**
 * Schema for link ID params
 */
export const LinkIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Link ID must be a number'),
});

export type LinkIdParams = z.infer<typeof LinkIdParamsSchema>;

/**
 * Schema for issue ID params (for listing links)
 */
export const IssueIdForLinksParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Issue ID must be a number'),
});

export type IssueIdForLinksParams = z.infer<typeof IssueIdForLinksParamsSchema>;
