export const ISSUE_TYPES = ['memo', 'task', 'article'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const TASK_KINDS = ['event', 'action'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

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
  /** Sync identity: client- or server-generated UUID (migration 014). Always set by repositories. */
  uuid?: string;
  /** Sync cursor: global monotonic sequence stamped by DB triggers (migration 014). */
  serverSeq?: number;
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
  labels?: string[];
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
  taskKind: TaskKind;
  commentCount?: number;
  preview?: string;
}

export const TEMPLATE_TARGETS = ['task', 'article'] as const;
export type TemplateTarget = (typeof TEMPLATE_TARGETS)[number];

/**
 * A creation-time scaffold stored as an issue (type='template', migration 015).
 * Templates are intentionally NOT part of the `Issue` union: they are a separate
 * concern handled by dedicated repositories/services and never flow through
 * generic Issue consumers. `templateTarget` records what the template produces
 * (task or article), chosen at creation. Applying a template copies its bodyMd +
 * labels + projects onto a new issue of that target type.
 */
export interface Template extends Omit<IssueBase, 'type'> {
  type: 'template';
  templateTarget: TemplateTarget;
  labels?: string[];
  preview?: string;
}

export type Issue = Memo | Task | Article;

export interface Comment extends Timestamped {
  id: number;
  /** Sync identity (migration 014). Always set by repositories. */
  uuid?: string;
  /** Sync cursor (migration 014). */
  serverSeq?: number;
  issueId: number;
  bodyMd: string;
  isDeleted: boolean;
}

export interface Label {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  /** Sync cursor (migration 014). Labels are identified by name, so no uuid. */
  serverSeq?: number;
  memoCount: number;
  taskCount: number;
  articleCount: number;
}

export interface Link {
  id: number;
  sourceIssueId: number;
  targetIssueId: number;
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';
  createdAt: string;
}

export interface UrlLink {
  id: number;
  issueId: number;
  url: string;
  title: string | null;
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
  ArticleEventType,
  EventType,
  ProjectSnapshot,
  LabelSnapshot,
  BasePayload,
  ActivityLogEntry,
  CreateActivityLogInput,
  CompletedTaskEntry,
  ActivityLogFilters,
} from './types/activity-log.js';

// Activity Log constants (runtime-accessible values)
export {
  SOURCE_TYPES,
  ISSUE_EVENT_TYPES,
  LABEL_EVENT_TYPES,
  PROJECT_EVENT_TYPES,
  LINK_EVENT_TYPES,
  COMMENT_EVENT_TYPES,
  ARTICLE_EVENT_TYPES,
  SEARCH_EVENT_TYPES,
  ALL_EVENT_TYPES,
} from './types/activity-log.js';

export const toBoolean = (value: number | boolean): boolean =>
  typeof value === 'boolean' ? value : value !== 0;

export const nowIso = (): string => new Date().toISOString();

/**
 * Generate a UUIDv7 (time-ordered UUID) for sync identities.
 * Time-ordered so uuid indexes stay append-friendly; uses globalThis.crypto,
 * which is available in Node 20+ and browsers alike.
 */
export const uuidv7 = (): string => {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const ts = Date.now();
  bytes[0] = Math.floor(ts / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ts / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ts / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ts / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ts / 2 ** 8) & 0xff;
  bytes[5] = ts & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};