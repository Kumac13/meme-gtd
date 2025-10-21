import { z } from 'zod';

/**
 * Schema for creating a new memo
 */
export const CreateMemoRequestSchema = z.object({
  bodyMd: z.string().min(1, 'Memo body cannot be empty').describe('Memo content in Markdown format'),
});

export type CreateMemoRequest = z.infer<typeof CreateMemoRequestSchema>;

/**
 * Schema for updating a memo
 */
export const UpdateMemoRequestSchema = z.object({
  bodyMd: z.string().min(1, 'Memo body cannot be empty').optional().describe('Updated memo content in Markdown format'),
  isBookmarked: z.boolean().optional().describe('Bookmark status'),
});

export type UpdateMemoRequest = z.infer<typeof UpdateMemoRequestSchema>;

/**
 * Schema for promoting a memo to a task
 */
export const PromoteMemoRequestSchema = z.object({
  title: z.string().min(1, 'Task title is required').describe('Title for the new task'),
  status: z.enum(['open', 'next', 'waiting', 'scheduled']).optional().describe('Initial status for the task'),
});

export type PromoteMemoRequest = z.infer<typeof PromoteMemoRequestSchema>;

/**
 * Schema for memo response
 */
export const MemoSchema = z.object({
  id: z.number().int().positive().describe('Unique memo ID'),
  type: z.literal('memo').describe('Issue type (always "memo")'),
  title: z.string().nullable().describe('Title (always null for memos)'),
  bodyMd: z.string().describe('Memo content in Markdown format'),
  status: z.string().nullable().describe('Status (always null for memos)'),
  scheduledOn: z.string().date().nullable().describe('Scheduled date (always null for memos)'),
  meta: z.record(z.any()).describe('Metadata object'),
  isBookmarked: z.boolean().describe('Whether the memo is bookmarked'),
  isDeleted: z.boolean().describe('Whether the memo is soft-deleted'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
  labels: z.array(z.string()).describe('Array of label names assigned to this memo'),
});

export type Memo = z.infer<typeof MemoSchema>;

/**
 * Schema for memo list item response (includes commentCount)
 */
export const MemoListItemSchema = MemoSchema.extend({
  commentCount: z.number().int().nonnegative().describe('Number of non-deleted comments on this memo'),
});

export type MemoListItem = z.infer<typeof MemoListItemSchema>;

/**
 * Schema for memo detail response (includes labels and comments count)
 */
export const MemoDetailSchema = MemoSchema.extend({
  commentsCount: z.number().int().nonnegative().optional().describe('Number of comments on this memo'),
});

export type MemoDetail = z.infer<typeof MemoDetailSchema>;

/**
 * Schema for bookmark/unbookmark request
 */
export const BookmarkRequestSchema = z.object({
  isBookmarked: z.boolean().describe('Bookmark status to set'),
});

export type BookmarkRequest = z.infer<typeof BookmarkRequestSchema>;

/**
 * Schema for memo ID params
 */
export const MemoIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number').describe('Memo ID'),
});

export type MemoIdParams = z.infer<typeof MemoIdParamsSchema>;

/**
 * Schema for memo query filters
 */
export const MemoQuerySchema = z.object({
  bookmarked: z.enum(['true', 'false']).optional().describe('Filter by bookmark status'),
});

export type MemoQuery = z.infer<typeof MemoQuerySchema>;
