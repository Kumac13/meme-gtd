import { z } from 'zod';

/**
 * Schema for creating a new label
 */
export const CreateLabelRequestSchema = z.object({
  name: z.string().min(1, 'Label name is required'),
  description: z.string().nullable().optional(),
});

export type CreateLabelRequest = z.infer<typeof CreateLabelRequestSchema>;

/**
 * Schema for label response
 */
export const LabelSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type Label = z.infer<typeof LabelSchema>;

/**
 * Schema for assigning a label to an issue
 * Assigns a single label by labelId (idempotent)
 */
export const AssignLabelRequestSchema = z.object({
  labelId: z.number().int().positive(),
});

export type AssignLabelRequest = z.infer<typeof AssignLabelRequestSchema>;

/**
 * Schema for label name params
 */
export const LabelNameParamsSchema = z.object({
  name: z.string().min(1, 'Label name is required'),
});

export type LabelNameParams = z.infer<typeof LabelNameParamsSchema>;

/**
 * Schema for issue ID params (for label assignment)
 */
export const IssueIdParamsSchema = z.object({
  issueId: z.string().regex(/^\d+$/, 'Issue ID must be a number'),
});

export type IssueIdParams = z.infer<typeof IssueIdParamsSchema>;
