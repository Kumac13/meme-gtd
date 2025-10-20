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
export const MemoCommentParamsSchema = z.object({
  memoId: z.string().regex(/^\d+$/, 'Memo ID must be a number').describe('Memo ID'),
});

export type MemoCommentParams = z.infer<typeof MemoCommentParamsSchema>;

export const TaskCommentParamsSchema = z.object({
  taskId: z.string().regex(/^\d+$/, 'Task ID must be a number').describe('Task ID'),
});

export type TaskCommentParams = z.infer<typeof TaskCommentParamsSchema>;

export const MemoCommentIdParamsSchema = MemoCommentParamsSchema.extend({
  commentId: z.string().regex(/^\d+$/, 'Comment ID must be a number').describe('Comment ID'),
});

export type MemoCommentIdParams = z.infer<typeof MemoCommentIdParamsSchema>;

export const TaskCommentIdParamsSchema = TaskCommentParamsSchema.extend({
  commentId: z.string().regex(/^\d+$/, 'Comment ID must be a number').describe('Comment ID'),
});

export type TaskCommentIdParams = z.infer<typeof TaskCommentIdParamsSchema>;
