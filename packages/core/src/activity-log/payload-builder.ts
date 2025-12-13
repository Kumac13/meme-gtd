import Database from 'better-sqlite3';
import type {
  ProjectSnapshot,
  LabelSnapshot,
  IssueType,
  TaskStatus,
} from 'meme-gtd-shared';

/**
 * Maximum length for body preview in payloads
 */
const BODY_PREVIEW_MAX_LENGTH = 100;

/**
 * Truncate text to create a preview
 */
export const createBodyPreview = (text: string | null): string | null => {
  if (!text) return null;
  if (text.length <= BODY_PREVIEW_MAX_LENGTH) return text;
  return text.substring(0, BODY_PREVIEW_MAX_LENGTH) + '...';
};

/**
 * Get project snapshots for an issue
 * Returns array of {id, name} for all projects the issue belongs to
 */
export const getProjectSnapshots = (
  db: Database.Database,
  issueId: number
): ProjectSnapshot[] => {
  const sql = `
    SELECT p.id, p.name
    FROM projects p
    JOIN project_items pi ON p.id = pi.project_id
    WHERE pi.issue_id = ?
    ORDER BY p.name
  `;
  const stmt = db.prepare(sql);
  const rows = stmt.all(issueId) as Array<{ id: number; name: string }>;
  return rows.map((row) => ({ id: row.id, name: row.name }));
};

/**
 * Get label snapshots for an issue
 * Returns array of {id, name} for all labels attached to the issue
 */
export const getLabelSnapshots = (
  db: Database.Database,
  issueId: number
): LabelSnapshot[] => {
  const sql = `
    SELECT l.id, l.name
    FROM labels l
    JOIN issue_labels il ON l.id = il.label_id
    WHERE il.issue_id = ?
    ORDER BY l.name
  `;
  const stmt = db.prepare(sql);
  const rows = stmt.all(issueId) as Array<{ id: number; name: string }>;
  return rows.map((row) => ({ id: row.id, name: row.name }));
};

/**
 * Get issue title for snapshot
 */
export const getIssueTitle = (
  db: Database.Database,
  issueId: number
): string | null => {
  const sql = `SELECT title FROM issues WHERE id = ?`;
  const stmt = db.prepare(sql);
  const row = stmt.get(issueId) as { title: string | null } | undefined;
  return row?.title ?? null;
};

/**
 * Get issue type for snapshot
 */
export const getIssueType = (
  db: Database.Database,
  issueId: number
): IssueType | null => {
  const sql = `SELECT type FROM issues WHERE id = ?`;
  const stmt = db.prepare(sql);
  const row = stmt.get(issueId) as { type: IssueType } | undefined;
  return row?.type ?? null;
};

/**
 * Get project name for snapshot
 */
export const getProjectName = (
  db: Database.Database,
  projectId: number
): string | null => {
  const sql = `SELECT name FROM projects WHERE id = ?`;
  const stmt = db.prepare(sql);
  const row = stmt.get(projectId) as { name: string } | undefined;
  return row?.name ?? null;
};

/**
 * Get label name for snapshot
 */
export const getLabelName = (
  db: Database.Database,
  labelId: number
): string | null => {
  const sql = `SELECT name FROM labels WHERE id = ?`;
  const stmt = db.prepare(sql);
  const row = stmt.get(labelId) as { name: string } | undefined;
  return row?.name ?? null;
};

// ============================================================
// Payload builders for each event type
// ============================================================

/**
 * Build payload for task.created event
 */
interface TaskCreatedPayload {
  issue_id: number;
  issue_type: 'task';
  title: string;
  status: TaskStatus;
  scheduled_start?: string | null;
  is_all_day?: boolean;
  labels: LabelSnapshot[];
  projects: ProjectSnapshot[];
}

export const buildTaskCreatedPayload = (
  db: Database.Database,
  taskId: number,
  title: string,
  status: TaskStatus,
  scheduledStart?: string | null,
  isAllDay?: boolean
): TaskCreatedPayload => {
  return {
    issue_id: taskId,
    issue_type: 'task',
    title,
    status,
    scheduled_start: scheduledStart,
    is_all_day: isAllDay,
    labels: getLabelSnapshots(db, taskId),
    projects: getProjectSnapshots(db, taskId),
  };
};

/**
 * Build payload for task.status_changed event
 */
interface TaskStatusChangedPayload {
  issue_id: number;
  issue_type: 'task';
  title: string | null;
  from_status: TaskStatus;
  to_status: TaskStatus;
  project_snapshot: ProjectSnapshot[];
  label_snapshot: LabelSnapshot[];
}

export const buildTaskStatusChangedPayload = (
  db: Database.Database,
  taskId: number,
  fromStatus: TaskStatus,
  toStatus: TaskStatus
): TaskStatusChangedPayload => {
  return {
    issue_id: taskId,
    issue_type: 'task',
    title: getIssueTitle(db, taskId),
    from_status: fromStatus,
    to_status: toStatus,
    project_snapshot: getProjectSnapshots(db, taskId),
    label_snapshot: getLabelSnapshots(db, taskId),
  };
};

/**
 * Build payload for label.assigned event
 */
interface LabelAssignedPayload {
  issue_id: number;
  issue_type: IssueType;
  issue_title: string | null;
  label_id: number;
  label_name: string | null;
}

export const buildLabelAssignedPayload = (
  db: Database.Database,
  issueId: number,
  labelId: number
): LabelAssignedPayload => {
  return {
    issue_id: issueId,
    issue_type: getIssueType(db, issueId) ?? 'task',
    issue_title: getIssueTitle(db, issueId),
    label_id: labelId,
    label_name: getLabelName(db, labelId),
  };
};

/**
 * Build payload for project.item_added event
 */
interface ProjectItemAddedPayload {
  project_id: number;
  project_name: string | null;
  issue_id: number;
  issue_type: IssueType;
  issue_title: string | null;
  position?: number;
}

export const buildProjectItemAddedPayload = (
  db: Database.Database,
  projectId: number,
  issueId: number,
  position?: number
): ProjectItemAddedPayload => {
  return {
    project_id: projectId,
    project_name: getProjectName(db, projectId),
    issue_id: issueId,
    issue_type: getIssueType(db, issueId) ?? 'task',
    issue_title: getIssueTitle(db, issueId),
    position,
  };
};

/**
 * Build payload for comment.created event
 */
interface CommentCreatedPayload {
  comment_id: number;
  issue_id: number;
  issue_type: IssueType;
  issue_title: string | null;
  body: string;
}

export const buildCommentCreatedPayload = (
  db: Database.Database,
  commentId: number,
  issueId: number,
  bodyMd: string
): CommentCreatedPayload => {
  return {
    comment_id: commentId,
    issue_id: issueId,
    issue_type: getIssueType(db, issueId) ?? 'task',
    issue_title: getIssueTitle(db, issueId),
    body: bodyMd,
  };
};

/**
 * Build payload for link.created event
 */
interface LinkCreatedPayload {
  link_id: number;
  link_type: string;
  source_issue_id: number;
  source_issue_type: IssueType | null;
  source_issue_title: string | null;
  target_issue_id: number;
  target_issue_type: IssueType | null;
  target_issue_title: string | null;
}

export const buildLinkCreatedPayload = (
  db: Database.Database,
  linkId: number,
  linkType: string,
  sourceIssueId: number,
  targetIssueId: number
): LinkCreatedPayload => {
  return {
    link_id: linkId,
    link_type: linkType,
    source_issue_id: sourceIssueId,
    source_issue_type: getIssueType(db, sourceIssueId),
    source_issue_title: getIssueTitle(db, sourceIssueId),
    target_issue_id: targetIssueId,
    target_issue_type: getIssueType(db, targetIssueId),
    target_issue_title: getIssueTitle(db, targetIssueId),
  };
};

/**
 * Build payload for memo.promoted event
 */
interface MemoPromotedPayload {
  issue_id: number;
  source_memo_id: number;
  source_memo_body: string | null;
  promoted_task: {
    id: number;
    title: string;
    status: TaskStatus;
  };
  link_id?: number;
}

export const buildMemoPromotedPayload = (
  memoId: number,
  memoBody: string,
  promotedTaskId: number,
  promotedTaskTitle: string,
  promotedTaskStatus: TaskStatus,
  linkId?: number
): MemoPromotedPayload => {
  return {
    issue_id: promotedTaskId,
    source_memo_id: memoId,
    source_memo_body: memoBody || null,
    promoted_task: {
      id: promotedTaskId,
      title: promotedTaskTitle,
      status: promotedTaskStatus,
    },
    link_id: linkId,
  };
};

/**
 * Build payload for article.created event
 */
interface ArticleCreatedPayload {
  issue_id: number;
  issue_type: 'article';
  title: string;
  body: string;
  original_url: string;
  labels: LabelSnapshot[];
  projects: ProjectSnapshot[];
}

export const buildArticleCreatedPayload = (
  db: Database.Database,
  articleId: number,
  title: string,
  bodyMd: string,
  originalUrl: string
): ArticleCreatedPayload => {
  return {
    issue_id: articleId,
    issue_type: 'article',
    title,
    body: bodyMd,
    original_url: originalUrl,
    labels: getLabelSnapshots(db, articleId),
    projects: getProjectSnapshots(db, articleId),
  };
};
