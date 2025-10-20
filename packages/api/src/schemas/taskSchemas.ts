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
  title: z.string().min(1, 'Task title is required'),
  bodyMd: z.string().optional(),
  status: TaskStatusSchema.optional(),
  scheduledOn: z.string().datetime().optional(),
});

export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

/**
 * Schema for updating a task
 */
export const UpdateTaskRequestSchema = z.object({
  title: z.string().min(1, 'Task title cannot be empty').optional(),
  bodyMd: z.string().optional(),
  status: TaskStatusSchema.optional(),
  scheduledOn: z.string().datetime().nullish(),
});

export type UpdateTaskRequest = z.infer<typeof UpdateTaskRequestSchema>;

/**
 * Schema for task response
 */
export const TaskSchema = z.object({
  id: z.number().int().positive(),
  type: z.literal('task'),
  title: z.string(),
  bodyMd: z.string(),
  status: TaskStatusSchema,
  scheduledOn: z.string().datetime().nullable(),
  meta: z.record(z.any()),
  isBookmarked: z.boolean(),
  isDeleted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Schema for task detail response (includes labels and comments count)
 */
export const TaskDetailSchema = TaskSchema.extend({
  labels: z.array(z.string()).optional(),
  commentsCount: z.number().int().nonnegative().optional(),
});

export type TaskDetail = z.infer<typeof TaskDetailSchema>;

/**
 * Schema for task ID params
 */
export const TaskIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number'),
});

export type TaskIdParams = z.infer<typeof TaskIdParamsSchema>;

/**
 * Schema for task query filters
 */
export const TaskQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  bookmarked: z.enum(['true', 'false']).optional(),
});

export type TaskQuery = z.infer<typeof TaskQuerySchema>;
