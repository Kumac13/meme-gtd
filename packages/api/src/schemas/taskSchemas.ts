import { z } from 'zod';

/**
 * Schema for task status values
 */
export const TaskStatusSchema = z.enum(['open', 'next', 'waiting', 'scheduled', 'done', 'canceled']);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Schema for creating a new task
 */
export const CreateTaskRequestSchema = z.object({
  title: z.string().min(1, 'Task title is required').describe('Task title'),
  bodyMd: z.string().optional().describe('Task description in Markdown format'),
  status: TaskStatusSchema.optional().describe('Task status (defaults to "open")'),
  scheduledOn: z.string().datetime().optional().describe('Scheduled date/time for the task'),
});

export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

/**
 * Schema for updating a task
 */
export const UpdateTaskRequestSchema = z.object({
  title: z.string().min(1, 'Task title cannot be empty').optional().describe('Updated task title'),
  bodyMd: z.string().optional().describe('Updated task description in Markdown format'),
  status: TaskStatusSchema.optional().describe('Updated task status'),
  scheduledOn: z.string().datetime().nullish().describe('Updated scheduled date/time (null to clear)'),
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
  scheduledOn: z.string().datetime().nullable().describe('Scheduled date/time for the task (null if not scheduled)'),
  meta: z.record(z.any()).describe('Metadata object'),
  isBookmarked: z.boolean().describe('Whether the task is bookmarked'),
  isDeleted: z.boolean().describe('Whether the task is soft-deleted'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Schema for task detail response (includes labels and comments count)
 */
export const TaskDetailSchema = TaskSchema.extend({
  labels: z.array(z.string()).optional().describe('Array of label names assigned to this task'),
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
});

export type TaskQuery = z.infer<typeof TaskQuerySchema>;
