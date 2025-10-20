import { z } from 'zod';

/**
 * Schema for creating a new memo
 */
export const CreateMemoRequestSchema = z.object({
  bodyMd: z.string().min(1, 'Memo body cannot be empty'),
});

export type CreateMemoRequest = z.infer<typeof CreateMemoRequestSchema>;

/**
 * Schema for updating a memo
 */
export const UpdateMemoRequestSchema = z.object({
  bodyMd: z.string().min(1, 'Memo body cannot be empty').optional(),
  isBookmarked: z.boolean().optional(),
});

export type UpdateMemoRequest = z.infer<typeof UpdateMemoRequestSchema>;

/**
 * Schema for promoting a memo to a task
 */
export const PromoteMemoRequestSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  status: z.enum(['open', 'next', 'waiting', 'scheduled']).optional(),
});

export type PromoteMemoRequest = z.infer<typeof PromoteMemoRequestSchema>;

/**
 * Schema for memo response
 */
export const MemoSchema = z.object({
  id: z.number().int().positive(),
  type: z.literal('memo'),
  bodyMd: z.string(),
  meta: z.record(z.any()),
  isBookmarked: z.boolean(),
  isDeleted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Memo = z.infer<typeof MemoSchema>;

/**
 * Schema for memo detail response (includes labels and comments count)
 */
export const MemoDetailSchema = MemoSchema.extend({
  labels: z.array(z.string()).optional(),
  commentsCount: z.number().int().nonnegative().optional(),
});

export type MemoDetail = z.infer<typeof MemoDetailSchema>;

/**
 * Schema for bookmark/unbookmark request
 */
export const BookmarkRequestSchema = z.object({
  isBookmarked: z.boolean(),
});

export type BookmarkRequest = z.infer<typeof BookmarkRequestSchema>;

/**
 * Schema for memo ID params
 */
export const MemoIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number'),
});

export type MemoIdParams = z.infer<typeof MemoIdParamsSchema>;

/**
 * Schema for memo query filters
 */
export const MemoQuerySchema = z.object({
  bookmarked: z.enum(['true', 'false']).optional(),
});

export type MemoQuery = z.infer<typeof MemoQuerySchema>;
