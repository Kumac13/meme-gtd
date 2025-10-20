import { z } from 'zod';

/**
 * Schema for creating a new comment
 */
export const CreateCommentRequestSchema = z.object({
  bodyMd: z.string().min(1, 'Comment body cannot be empty'),
});

export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;

/**
 * Schema for updating a comment
 */
export const UpdateCommentRequestSchema = z.object({
  bodyMd: z.string().min(1, 'Comment body cannot be empty'),
});

export type UpdateCommentRequest = z.infer<typeof UpdateCommentRequestSchema>;

/**
 * Schema for comment response
 */
export const CommentSchema = z.object({
  id: z.number().int().positive(),
  issueId: z.number().int().positive(),
  bodyMd: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Comment = z.infer<typeof CommentSchema>;

/**
 * Schema for memo/task ID params (for comment endpoints)
 */
export const IssueIdParamsSchema = z.object({
  memoId: z.string().regex(/^\d+$/, 'Memo ID must be a number').optional(),
  taskId: z.string().regex(/^\d+$/, 'Task ID must be a number').optional(),
});

export type IssueIdParams = z.infer<typeof IssueIdParamsSchema>;

/**
 * Schema for comment ID params
 */
export const CommentIdParamsSchema = z.object({
  memoId: z.string().regex(/^\d+$/).optional(),
  taskId: z.string().regex(/^\d+$/).optional(),
  commentId: z.string().regex(/^\d+$/, 'Comment ID must be a number'),
});

export type CommentIdParams = z.infer<typeof CommentIdParamsSchema>;
