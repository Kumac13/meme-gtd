import { z } from 'zod';

/**
 * Schema for creating a new label
 */
export const CreateLabelRequestSchema = z.object({
  name: z.string().min(1, 'Label name is required').describe('Label name (unique identifier)'),
  description: z.string().optional().describe('Optional label description'),
});

export type CreateLabelRequest = z.infer<typeof CreateLabelRequestSchema>;

/**
 * Schema for label response
 */
export const LabelSchema = z.object({
  id: z.number().int().positive().describe('Unique label ID'),
  name: z.string().describe('Label name'),
  description: z.string().nullable().describe('Label description (null if not set)'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
});

export type Label = z.infer<typeof LabelSchema>;

/**
 * Schema for assigning a label to an issue
 * Assigns a single label by labelId (idempotent)
 */
export const AssignLabelRequestSchema = z.object({
  labelId: z.number().int().positive().describe('ID of the label to assign'),
});

export type AssignLabelRequest = z.infer<typeof AssignLabelRequestSchema>;

/**
 * Schema for label name params
 */
export const LabelNameParamsSchema = z.object({
  name: z.string().min(1, 'Label name is required').describe('Label name'),
});

export type LabelNameParams = z.infer<typeof LabelNameParamsSchema>;

/**
 * Schema for issue ID params (for label assignment)
 */
export const IssueIdParamsSchema = z.object({
  issueId: z.string().regex(/^\d+$/, 'Issue ID must be a number').describe('Issue ID (memo or task)'),
});

export type IssueIdParams = z.infer<typeof IssueIdParamsSchema>;
