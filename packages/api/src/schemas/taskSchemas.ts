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
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional().describe('Start time (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional().describe('End time (HH:MM)'),
  duration: z.number().int().positive().optional().describe('Duration in minutes'),
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
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').nullish().describe('Updated start time (HH:MM, null to clear)'),
  endDate: z.string().date().nullish().describe('Updated end date (YYYY-MM-DD, null to clear)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').nullish().describe('Updated end time (HH:MM, null to clear)'),
  duration: z.number().int().positive().nullish().describe('Updated duration in minutes (null to clear)'),
  addLabels: z.array(z.string()).optional(),
  removeLabels: z.array(z.string()).optional(),
  projectIds: z.array(z.number().int()).optional()
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
  startTime: z.string().nullable().describe('Start time (HH:MM, null if not set)'),
  endDate: z.string().date().nullable().describe('End date for the task (YYYY-MM-DD, null if not scheduled)'),
  endTime: z.string().nullable().describe('End time (HH:MM, null if not set)'),
  duration: z.number().int().nullable().describe('Duration in minutes (null if not set)'),
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
  scheduledFrom: z.string().date().optional().describe('Filter tasks where scheduled_on >= this date (YYYY-MM-DD)'),
  scheduledTo: z.string().date().optional().describe('Filter tasks where scheduled_on <= this date (YYYY-MM-DD)'),
});

export type TaskQuery = z.infer<typeof TaskQuerySchema>;

/**
 * Schema for demoting a task to a memo
 */
export const DemoteTaskRequestSchema = z.object({
  bodyMd: z.string().optional().describe('Custom body for the memo (if not provided, body is auto-generated from task content)'),
  labels: z.array(z.string()).optional().describe('Labels to apply to the new memo (if not provided, inherits from task)'),
});

export type DemoteTaskRequest = z.infer<typeof DemoteTaskRequestSchema>;

/**
 * Schema for demote task response
 */
export const DemoteTaskResponseSchema = z.object({
  task: TaskSchema.describe('The original task (unchanged)'),
  memoId: z.number().int().positive().describe('ID of the newly created memo'),
});

export type DemoteTaskResponse = z.infer<typeof DemoteTaskResponseSchema>;
