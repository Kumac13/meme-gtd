/**
 * Activity Log Types
 * Event sourcing style activity log for tracking all user actions
 */

// Source types for activity log entries
export const SOURCE_TYPES = ['cli', 'api', 'system'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

// Event type categories - defined as const arrays for runtime access
export const ISSUE_EVENT_TYPES = [
  'task.created',
  'task.updated',
  'task.status_changed',
  'task.deleted',
  'task.bookmarked',
  'memo.created',
  'memo.updated',
  'memo.promoted',
  'memo.deleted',
  'memo.bookmarked',
] as const;
export type IssueEventType = (typeof ISSUE_EVENT_TYPES)[number];

export const LABEL_EVENT_TYPES = [
  'label.created',
  'label.deleted',
  'label.assigned',
  'label.removed',
] as const;
export type LabelEventType = (typeof LABEL_EVENT_TYPES)[number];

export const PROJECT_EVENT_TYPES = [
  'project.created',
  'project.updated',
  'project.deleted',
  'project.item_added',
  'project.item_removed',
] as const;
export type ProjectEventType = (typeof PROJECT_EVENT_TYPES)[number];

export const LINK_EVENT_TYPES = ['link.created', 'link.deleted'] as const;
export type LinkEventType = (typeof LINK_EVENT_TYPES)[number];

export const COMMENT_EVENT_TYPES = [
  'comment.created',
  'comment.updated',
  'comment.deleted',
] as const;
export type CommentEventType = (typeof COMMENT_EVENT_TYPES)[number];

export const ARTICLE_EVENT_TYPES = [
  'article.created',
  'article.deleted',
] as const;
export type ArticleEventType = (typeof ARTICLE_EVENT_TYPES)[number];

export const SEARCH_EVENT_TYPES = ['search.exported'] as const;

// All event types - single source of truth
export const ALL_EVENT_TYPES = [
  ...ISSUE_EVENT_TYPES,
  ...LABEL_EVENT_TYPES,
  ...PROJECT_EVENT_TYPES,
  ...LINK_EVENT_TYPES,
  ...COMMENT_EVENT_TYPES,
  ...ARTICLE_EVENT_TYPES,
  ...SEARCH_EVENT_TYPES,
] as const;
export type EventType = (typeof ALL_EVENT_TYPES)[number];

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
  issue_type?: 'task' | 'memo' | 'article';
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
