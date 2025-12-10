import { z } from 'zod';

/**
 * Schema for source type values
 */
export const SourceTypeSchema = z.enum(['cli', 'api', 'system']);

export type SourceType = z.infer<typeof SourceTypeSchema>;

/**
 * Schema for event type values
 */
export const EventTypeSchema = z.enum([
  // Issue events (Task/Memo)
  'task.created',
  'task.updated',
  'task.status_changed',
  'task.deleted',
  'task.bookmarked',
  'memo.created',
  'memo.updated',
  'memo.promoted',
  'memo.deleted',
  // Label events
  'label.created',
  'label.deleted',
  'label.assigned',
  'label.removed',
  // Project events
  'project.created',
  'project.updated',
  'project.deleted',
  'project.item_added',
  'project.item_removed',
  // Link events
  'link.created',
  'link.deleted',
  // Comment events
  'comment.created',
  'comment.updated',
  'comment.deleted',
]);

export type EventType = z.infer<typeof EventTypeSchema>;

/**
 * Schema for project snapshot
 */
export const ProjectSnapshotSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

/**
 * Schema for label snapshot
 */
export const LabelSnapshotSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

/**
 * Schema for activity log entry response
 */
export const ActivityLogEntrySchema = z.object({
  id: z.number().int().positive().describe('Unique identifier'),
  eventType: EventTypeSchema.describe('Event type (e.g., task.created, task.status_changed)'),
  occurredAt: z.string().describe('Event timestamp (ISO 8601)'),
  sourceType: SourceTypeSchema.describe('Source of the operation'),
  payload: z.record(z.unknown()).describe('Event-specific data'),
  issueId: z.number().int().nullable().describe('Related issue ID (extracted from payload)'),
  projectId: z.number().int().nullable().describe('Related project ID (extracted from payload)'),
  labelId: z.number().int().nullable().describe('Related label ID (extracted from payload)'),
});

export type ActivityLogEntry = z.infer<typeof ActivityLogEntrySchema>;

/**
 * Schema for completed task entry response
 */
export const CompletedTaskEntrySchema = z.object({
  taskId: z.number().int().positive().describe('Task ID'),
  title: z.string().describe('Task title at completion time'),
  completedAt: z.string().describe('Completion timestamp'),
  projectSnapshot: z.array(ProjectSnapshotSchema).optional().describe('Projects at completion time'),
  labelSnapshot: z.array(LabelSnapshotSchema).optional().describe('Labels at completion time'),
});

export type CompletedTaskEntry = z.infer<typeof CompletedTaskEntrySchema>;

/**
 * Schema for issue ID path parameter
 */
export const IssueIdParamsSchema = z.object({
  issueId: z.coerce.number().int().positive().describe('Issue ID'),
});

/**
 * Schema for project ID path parameter
 */
export const ProjectIdParamsSchema = z.object({
  projectId: z.coerce.number().int().positive().describe('Project ID'),
});

/**
 * Schema for activity log list query parameters
 */
export const ActivityLogQuerySchema = z.object({
  issueId: z.coerce.number().int().positive().optional().describe('Filter by issue ID'),
  projectId: z.coerce.number().int().positive().optional().describe('Filter by project ID'),
  labelId: z.coerce.number().int().positive().optional().describe('Filter by label ID'),
  eventType: EventTypeSchema.optional().describe('Filter by event type'),
  sourceType: SourceTypeSchema.optional().describe('Filter by source type'),
  from: z.string().datetime().optional().describe('Filter logs from this datetime (ISO 8601)'),
  to: z.string().datetime().optional().describe('Filter logs until this datetime (ISO 8601)'),
  limit: z.coerce.number().int().positive().max(1000).default(100).describe('Maximum number of entries to return'),
  offset: z.coerce.number().int().min(0).default(0).describe('Number of entries to skip'),
  order: z.enum(['asc', 'desc']).default('desc').describe('Sort order by occurred_at'),
});

export type ActivityLogQuery = z.infer<typeof ActivityLogQuerySchema>;

/**
 * Schema for issue activity log query parameters
 */
export const IssueActivityLogQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(100).describe('Maximum number of entries to return'),
  order: z.enum(['asc', 'desc']).default('asc').describe('Sort order by occurred_at'),
});

/**
 * Schema for project activity log query parameters
 */
export const ProjectActivityLogQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(100).describe('Maximum number of entries to return'),
  order: z.enum(['asc', 'desc']).default('desc').describe('Sort order by occurred_at'),
});

/**
 * Schema for completed tasks query parameters
 */
export const CompletedTasksQuerySchema = z.object({
  from: z.string().date().optional().describe('Start date (YYYY-MM-DD), defaults to today'),
  to: z.string().date().optional().describe('End date (YYYY-MM-DD), defaults to today'),
  limit: z.coerce.number().int().positive().max(1000).default(100).describe('Maximum number of entries to return'),
});

export type CompletedTasksQuery = z.infer<typeof CompletedTasksQuerySchema>;
