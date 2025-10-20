import { z } from 'zod';

/**
 * Schema for creating a new comment
 */
export const CreateCommentRequestSchema = z.object({
  bodyMd: z.string().min(1, 'Comment body cannot be empty').describe('Comment content in Markdown format'),
});

export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;

/**
 * Schema for updating a comment
 */
export const UpdateCommentRequestSchema = z.object({
  bodyMd: z.string().min(1, 'Comment body cannot be empty').describe('Updated comment content in Markdown format'),
});

export type UpdateCommentRequest = z.infer<typeof UpdateCommentRequestSchema>;

/**
 * Schema for comment response
 */
export const CommentSchema = z.object({
  id: z.number().int().positive().describe('Unique comment ID'),
  issueId: z.number().int().positive().describe('ID of the parent issue (memo or task)'),
  bodyMd: z.string().describe('Comment content in Markdown format'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
});

export type Comment = z.infer<typeof CommentSchema>;

/**
 * Schema for memo/task ID params (for comment endpoints)
 */
export const IssueIdParamsSchema = z.object({
  memoId: z.string().regex(/^\d+$/, 'Memo ID must be a number').optional().describe('Memo ID (if commenting on a memo)'),
  taskId: z.string().regex(/^\d+$/, 'Task ID must be a number').optional().describe('Task ID (if commenting on a task)'),
});

export type IssueIdParams = z.infer<typeof IssueIdParamsSchema>;

/**
 * Schema for comment ID params
 */
export const CommentIdParamsSchema = z.object({
  memoId: z.string().regex(/^\d+$/).optional().describe('Memo ID (if comment is on a memo)'),
  taskId: z.string().regex(/^\d+$/).optional().describe('Task ID (if comment is on a task)'),
  commentId: z.string().regex(/^\d+$/, 'Comment ID must be a number').describe('Comment ID'),
});

export type CommentIdParams = z.infer<typeof CommentIdParamsSchema>;
