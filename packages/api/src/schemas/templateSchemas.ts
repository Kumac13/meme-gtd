import { z } from 'zod';

/**
 * A template's target: the issue type it produces when applied (migration 015).
 */
export const TemplateTargetSchema = z
  .enum(['task', 'article'])
  .describe('Issue type the template produces when applied');

/**
 * Schema for creating a new template
 */
export const CreateTemplateRequestSchema = z.object({
  title: z.string().min(1, 'Template title is required').describe('Template name'),
  bodyMd: z.string().describe('Template body skeleton in Markdown, copied into the new issue'),
  templateTarget: TemplateTargetSchema,
  labels: z.array(z.string()).optional().describe('Label names preset on the template (copied on apply)'),
  projectIds: z.array(z.number().int().positive()).optional().describe('Project ids preset on the template (copied on apply)'),
});

export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;

/**
 * Schema for updating a template (partial)
 */
export const UpdateTemplateRequestSchema = z.object({
  title: z.string().min(1).optional().describe('Template name'),
  bodyMd: z.string().optional().describe('Template body skeleton in Markdown'),
  templateTarget: TemplateTargetSchema.optional(),
  labels: z.array(z.string()).optional().describe('Label names (full replacement)'),
  projectIds: z.array(z.number().int().positive()).optional().describe('Project ids (full replacement)'),
});

export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequestSchema>;

/**
 * Schema for template query filters
 */
export const ListTemplatesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional().describe('Maximum number of templates to return'),
  offset: z.coerce.number().int().nonnegative().optional().describe('Number of templates to skip'),
  search: z.string().optional().describe('Search templates by title or body'),
  target: TemplateTargetSchema.optional().describe('Restrict to templates producing this issue type'),
});

export type ListTemplatesQuery = z.infer<typeof ListTemplatesQuerySchema>;

/**
 * Schema for template ID params
 */
export const TemplateIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number').describe('Template ID'),
});

export type TemplateIdParams = z.infer<typeof TemplateIdParamsSchema>;

/**
 * Schema for template response
 */
export const TemplateSchema = z.object({
  id: z.number().int().positive().describe('Unique template ID'),
  type: z.literal('template').describe('Issue type (always "template")'),
  templateTarget: TemplateTargetSchema,
  title: z.string().nullable().describe('Template name'),
  bodyMd: z.string().describe('Template body skeleton in Markdown'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
  isBookmarked: z.boolean().describe('Whether the template is bookmarked'),
  isDeleted: z.boolean().describe('Whether the template is soft-deleted'),
  labels: z.array(z.string()).optional().describe('Label names preset on the template'),
  projectIds: z.array(z.number().int().positive()).optional().describe('Project ids preset on the template'),
});

export type Template = z.infer<typeof TemplateSchema>;

/**
 * Schema for paginated template list response
 */
export const PaginatedTemplateListResponseSchema = z.object({
  data: z.array(TemplateSchema).describe('Array of templates'),
  total: z.number().int().nonnegative().describe('Total count of templates matching the filters (ignoring pagination)'),
  limit: z.number().int().positive().describe('Maximum number of templates returned per page'),
  offset: z.number().int().nonnegative().describe('Number of templates skipped'),
});

export type PaginatedTemplateListResponse = z.infer<typeof PaginatedTemplateListResponseSchema>;
