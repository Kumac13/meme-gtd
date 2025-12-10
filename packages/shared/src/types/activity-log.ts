/**
 * Activity Log Types
 * Event sourcing style activity log for tracking all user actions
 */

// Source types for activity log entries
export type SourceType = 'cli' | 'api' | 'system';

// Event type categories
export type IssueEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.status_changed'
  | 'task.deleted'
  | 'task.bookmarked'
  | 'memo.created'
  | 'memo.updated'
  | 'memo.promoted'
  | 'memo.deleted';

export type LabelEventType =
  | 'label.created'
  | 'label.deleted'
  | 'label.assigned'
  | 'label.removed';

export type ProjectEventType =
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.item_added'
  | 'project.item_removed';

export type LinkEventType = 'link.created' | 'link.deleted';

export type CommentEventType =
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted';

// All event types
export type EventType =
  | IssueEventType
  | LabelEventType
  | ProjectEventType
  | LinkEventType
  | CommentEventType;

// Snapshot types for preserving historical context
export interface ProjectSnapshot {
  id: number;
  name: string;
}

export interface LabelSnapshot {
  id: number;
  name: string;
}

// Base payload interface
export interface BasePayload {
  issue_id?: number;
  issue_type?: 'task' | 'memo';
  issue_title?: string | null;
  project_id?: number;
  project_name?: string;
  label_id?: number;
  label_name?: string;
  link_id?: number;
  comment_id?: number;
}

// Activity log entry
export interface ActivityLogEntry {
  id: number;
  eventType: EventType;
  occurredAt: string;
  sourceType: SourceType;
  payload: Record<string, unknown>;
  // Generated columns (extracted from payload)
  issueId: number | null;
  projectId: number | null;
  labelId: number | null;
  linkId: number | null;
  commentId: number | null;
}

// Input for creating activity log entry
export interface CreateActivityLogInput {
  eventType: EventType;
  sourceType: SourceType;
  payload: Record<string, unknown>;
}

// Completed task entry (for daily completed tasks query)
export interface CompletedTaskEntry {
  taskId: number;
  title: string;
  completedAt: string;
  projectSnapshot?: ProjectSnapshot[];
  labelSnapshot?: LabelSnapshot[];
}

// Filter options for listing activity logs
export interface ActivityLogFilters {
  issueId?: number;
  projectId?: number;
  labelId?: number;
  linkId?: number;
  commentId?: number;
  eventType?: EventType;
  sourceType?: SourceType;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}
