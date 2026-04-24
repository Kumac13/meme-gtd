import { z } from 'zod';
import { TaskStatusSchema, TaskKindSchema, iso8601DatetimeRegex } from './taskSchemas.js';

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
  status: TaskStatusSchema.optional().describe('Initial status for the task (defaults to "inbox")'),
  bodyMd: z.string().optional().describe('Override body. When omitted, the memo body is copied.'),
  taskKind: TaskKindSchema.optional().describe('Task kind (defaults to "action")'),
  scheduledStart: z.string().regex(iso8601DatetimeRegex, 'Invalid datetime format (YYYY-MM-DDTHH:MM:SS)').optional().describe('Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS)'),
  scheduledEnd: z.string().regex(iso8601DatetimeRegex, 'Invalid datetime format (YYYY-MM-DDTHH:MM:SS)').optional().describe('Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS)'),
  isAllDay: z.boolean().optional().describe('Whether this is an all-day event'),
});

export type PromoteMemoRequest = z.infer<typeof PromoteMemoRequestSchema>;

/**
 * Schema for promote preview response — the body a task would have if promoted now.
 */
export const PromotePreviewResponseSchema = z.object({
  bodyMd: z.string().describe('The task body that would be created by promoting this memo (memo body with comments inlined).'),
});

export type PromotePreviewResponse = z.infer<typeof PromotePreviewResponseSchema>;

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
  preview: z.string().optional().describe('Context preview with highlighted search terms (only present when search parameter is active)'),
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
const BookmarkRequestSchema = z.object({
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
  label: z.string().optional().describe('Filter by label name(s). Supports comma-separated values for OR logic (e.g., idea,meeting-notes)'),
  projectId: z.string().optional().describe('Filter by project ID(s). Supports comma-separated values for OR logic (e.g., 1,2,3). Use "none" to filter memos not assigned to any project. Can be combined: "none,1".'),
  search: z.string().optional().describe('Search memos by body content using free-text partial matching'),
  createdFrom: z.string().date().optional().describe('Filter memos created on or after this date (YYYY-MM-DD)'),
  createdTo: z.string().date().optional().describe('Filter memos created on or before this date (YYYY-MM-DD)'),
  limit: z.coerce.number().int().min(1).max(1000).optional().describe('Maximum number of memos to return (default: 100, max: 1000)'),
  offset: z.coerce.number().int().min(0).optional().describe('Number of memos to skip (default: 0)'),
});

export type MemoQuery = z.infer<typeof MemoQuerySchema>;

/**
 * Schema for paginated memo list response
 */
export const PaginatedMemoListResponseSchema = z.object({
  data: z.array(MemoListItemSchema).describe('Array of memos'),
  total: z.number().int().nonnegative().describe('Total count of memos matching the filters (ignoring pagination)'),
  limit: z.number().int().positive().describe('Maximum number of memos returned per page'),
  offset: z.number().int().nonnegative().describe('Number of memos skipped'),
});

export type PaginatedMemoListResponse = z.infer<typeof PaginatedMemoListResponseSchema>;
