export type IssueType = 'memo' | 'task' | 'article';

export type TaskStatus =
  | 'inbox'
  | 'open'
  | 'next'
  | 'waiting'
  | 'scheduled'
  | 'someday'
  | 'done'
  | 'canceled';

export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

export interface IssueBase extends Timestamped {
  id: number;
  type: IssueType;
  title: string | null;
  bodyMd: string;
  status: TaskStatus | null;

  // New scheduling fields (ISO 8601 datetime: YYYY-MM-DDTHH:MM:SS)
  scheduledStart: string | null;
  scheduledEnd: string | null;
  isAllDay: boolean;

  // New execution fields (auto-set on status change)
  actualStart: string | null;
  actualEnd: string | null;

  // Deprecated fields (read-only, for backward compatibility)
  /** @deprecated Use scheduledStart date portion */
  scheduledOn: string | null;
  /** @deprecated Use scheduledStart time portion */
  startTime: string | null; // HH:MM
  /** @deprecated Use scheduledEnd or actualEnd date portion */
  endDate: string | null; // YYYY-MM-DD
  /** @deprecated Use scheduledEnd or actualEnd time portion */
  endTime: string | null; // HH:MM
  /** @deprecated Calculate from scheduled times */
  duration: number | null; // minutes

  meta: unknown;
  isBookmarked: boolean;
  isDeleted: boolean;
}

export interface ArticleMeta {
  originalUrl: string;
  siteName?: string;
  archivedAt: string;
}

export interface Article extends IssueBase {
  type: 'article';
  title: string;
  meta: ArticleMeta;
  // Article doesn't use status/scheduling usually, but they are nullable in IssueBase
  status: null;
  scheduledStart: null;
  scheduledEnd: null;
  isAllDay: false;
  actualStart: null;
  actualEnd: null;
  scheduledOn: null;
  startTime: null;
  endDate: null;
  endTime: null;
  duration: null;
  commentCount?: number;
  preview?: string;
}

export interface Memo extends IssueBase {
  type: 'memo';
  title: null;
  status: null;
  // New fields (always null for memos)
  scheduledStart: null;
  scheduledEnd: null;
  isAllDay: false;
  actualStart: null;
  actualEnd: null;
  // Deprecated fields (always null for memos)
  scheduledOn: null;
  startTime: null;
  endDate: null;
  endTime: null;
  duration: null;
  commentCount?: number;
  preview?: string;
}

export interface Task extends IssueBase {
  type: 'task';
  title: string;
  status: TaskStatus;
  commentCount?: number;
  preview?: string;
}

export type Issue = Memo | Task | Article;

export interface Comment extends Timestamped {
  id: number;
  issueId: number;
  bodyMd: string;
  isDeleted: boolean;
}

export interface Label {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Link {
  id: number;
  sourceIssueId: number;
  targetIssueId: number;
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';
  createdAt: string;
}

// Project types (Issue #19)
export type {
  ViewType,
  ViewMeta,
  Project,
  ProjectItem,
  ProjectDetail,
  ProjectItemWithIssue
} from './types/project.js';

// Activity Log types
export type {
  SourceType,
  IssueEventType,
  LabelEventType,
  ProjectEventType,
  LinkEventType,
  CommentEventType,
  EventType,
  ProjectSnapshot,
  LabelSnapshot,
  BasePayload,
  ActivityLogEntry,
  CreateActivityLogInput,
  CompletedTaskEntry,
  ActivityLogFilters,
} from './types/activity-log.js';

export const toBoolean = (value: number | boolean): boolean =>
  typeof value === 'boolean' ? value : value !== 0;

export const nowIso = (): string => new Date().toISOString();