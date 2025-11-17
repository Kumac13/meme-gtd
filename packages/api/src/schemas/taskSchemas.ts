import { z } from 'zod';

/**
 * Schema for task status values
 */
export const TaskStatusSchema = z.enum(['inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled']);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Schema for creating a new task
 */
export const CreateTaskRequestSchema = z.object({
  title: z.string().min(1, 'Task title is required').describe('Task title'),
  bodyMd: z.string().optional().describe('Task description in Markdown format'),
  status: TaskStatusSchema.optional().describe('Task status (defaults to "inbox")'),
  scheduledOn: z.string().date().optional().describe('Scheduled date for the task (YYYY-MM-DD)'),
});

export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

/**
 * Schema for updating a task
 */
export const UpdateTaskRequestSchema = z.object({
  title: z.string().min(1, 'Task title cannot be empty').optional().describe('Updated task title'),
  bodyMd: z.string().optional().describe('Updated task description in Markdown format'),
  status: TaskStatusSchema.optional().describe('Updated task status'),
  scheduledOn: z.string().date().nullish().describe('Updated scheduled date (YYYY-MM-DD, null to clear)'),
});

export type UpdateTaskRequest = z.infer<typeof UpdateTaskRequestSchema>;

/**
 * Schema for task response
 */
export const TaskSchema = z.object({
  id: z.number().int().positive().describe('Unique task ID'),
  type: z.literal('task').describe('Issue type (always "task")'),
  title: z.string().describe('Task title'),
  bodyMd: z.string().describe('Task description in Markdown format'),
  status: TaskStatusSchema.describe('Current task status'),
  scheduledOn: z.string().date().nullable().describe('Scheduled date for the task (YYYY-MM-DD, null if not scheduled)'),
  meta: z.record(z.any()).describe('Metadata object'),
  isBookmarked: z.boolean().describe('Whether the task is bookmarked'),
  isDeleted: z.boolean().describe('Whether the task is soft-deleted'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
  labels: z.array(z.string()).describe('Array of label names assigned to this task'),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Schema for task list item response (includes commentCount)
 */
export const TaskListItemSchema = TaskSchema.extend({
  commentCount: z.number().int().nonnegative().describe('Number of non-deleted comments on this task'),
  preview: z.string().optional().describe('Context preview with highlighted search terms (only present when search parameter is active)'),
});

export type TaskListItem = z.infer<typeof TaskListItemSchema>;

/**
 * Schema for task detail response (includes labels and comments count)
 */
export const TaskDetailSchema = TaskSchema.extend({
  commentsCount: z.number().int().nonnegative().optional().describe('Number of comments on this task'),
});

export type TaskDetail = z.infer<typeof TaskDetailSchema>;

/**
 * Schema for task ID params
 */
export const TaskIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number').describe('Task ID'),
});

export type TaskIdParams = z.infer<typeof TaskIdParamsSchema>;

/**
 * Schema for task query filters
 */
export const TaskQuerySchema = z.object({
  status: TaskStatusSchema.optional().describe('Filter by task status'),
  bookmarked: z.enum(['true', 'false']).optional().describe('Filter by bookmark status'),
  label: z.string().optional().describe('Filter by label name(s). Supports comma-separated values for OR logic (e.g., bug,enhancement)'),
  search: z.string().optional().describe('Search tasks by title using free-text partial matching'),
});

export type TaskQuery = z.infer<typeof TaskQuerySchema>;
