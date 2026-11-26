import { z } from 'zod';
import { ISSUE_TYPES } from 'meme-gtd-shared';

/**
 * Schema for link type values
 */
const LinkTypeSchema = z.enum(['parent', 'child', 'relates', 'derived_from']);

export type LinkType = z.infer<typeof LinkTypeSchema>;

/**
 * Schema for creating a new link
 */
export const CreateLinkRequestSchema = z.object({
  sourceIssueId: z.number().int().positive().describe('Source issue ID'),
  targetIssueId: z.number().int().positive().describe('Target issue ID'),
  linkType: LinkTypeSchema.describe('Type of relationship between issues'),
  isPromotion: z
    .boolean()
    .optional()
    .describe(
      'Set to true only by the memo→task promotion flow so a memo.promoted activity event is recorded. Manual link creation must leave this unset.'
    ),
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
    type: z.enum(ISSUE_TYPES).describe('Target issue type'),
    title: z.string().describe('Target issue title (task title or memo body preview)'),
    status: z.string().nullable().describe('Target issue status (null for memos)'),
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

const PositiveIntegerQuerySchema = z.preprocess(
  value => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN,
  z.number().int().positive().safe(),
);
const BooleanQuerySchema = z.enum(['true', 'false']);

export const LinksGraphQuerySchema = z.object({
  rootId: PositiveIntegerQuerySchema.optional().describe('Start from this active Task, Memo or Article'),
  depth: PositiveIntegerQuerySchema.optional().describe('Maximum distance from rootId. Omit for all reachable issues'),
  q: z.string().optional().describe('Partial match in title, Markdown body or non-deleted comments'),
  label: z.string().optional().describe('Comma-separated label names (OR)'),
  projectId: z.string().optional().describe('Comma-separated positive project IDs or none (OR)'),
  bookmarked: BooleanQuerySchema.optional().describe('Filter to bookmarked issues'),
  includeLabels: BooleanQuerySchema.optional().describe('Include actual label memberships for the returned issues'),
});

export type LinksGraphQuery = z.infer<typeof LinksGraphQuerySchema>;

export const LinksGraphSchema = z.object({
  rootId: z.number().int().positive().nullable(),
  depth: z.number().int().positive().nullable(),
  nodes: z.array(z.object({
    id: z.number().int().positive(),
    type: z.enum(['task', 'memo', 'article']),
    title: z.string(),
    status: z.string().nullable(),
  })),
  edges: z.array(LinkSchema.omit({ createdAt: true })),
  labels: z.array(z.object({ id: z.number().int().positive(), name: z.string() })),
  memberships: z.array(z.object({
    issueId: z.number().int().positive(),
    labelId: z.number().int().positive(),
  })),
  truncated: z.boolean(),
  limits: z.object({
    issueNodes: z.number().int().positive(),
    issueEdges: z.number().int().positive(),
    labelNodes: z.number().int().positive(),
    memberships: z.number().int().positive(),
  }),
});
