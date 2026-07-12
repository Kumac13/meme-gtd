import Database from 'better-sqlite3';
import { nowIso, toBoolean } from 'meme-gtd-shared';

// Sync repository (migration 014): change feed reads and push bookkeeping.
// Unlike the other repositories, reads here include soft-deleted rows —
// is_deleted=1 rows are the tombstones for issues/comments.

export type SyncEntity = 'issue' | 'comment' | 'label' | 'issue_label';

export interface SyncChange {
  serverSeq: number;
  entity: SyncEntity;
  op: 'upsert' | 'delete';
  data: Record<string, unknown>;
}

export interface SyncChangesPage {
  changes: SyncChange[];
  latestSeq: number;
  hasMore: boolean;
}

export interface SyncIssueRecord {
  id: number;
  uuid: string;
  type: string;
  title: string | null;
  bodyMd: string;
  status: string | null;
  isBookmarked: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  serverSeq: number;
}

export interface SyncCommentRecord {
  id: number;
  uuid: string;
  issueId: number;
  issueUuid: string | null;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  serverSeq: number;
}

export const getLatestSeq = (db: Database.Database): number => {
  const row = db.prepare('SELECT seq FROM sync_sequence WHERE id = 1').get() as
    | { seq: number }
    | undefined;
  return row?.seq ?? 0;
};

const issueRowToChangeData = (row: any): Record<string, unknown> => ({
  id: row.id,
  uuid: row.uuid,
  type: row.type,
  title: row.title,
  bodyMd: row.body_md,
  status: row.status,
  taskKind: row.task_kind,
  templateTarget: row.template_target,
  origin: row.origin,
  scheduledStart: row.scheduled_start,
  scheduledEnd: row.scheduled_end,
  isAllDay: toBoolean(row.is_all_day ?? 0),
  actualStart: row.actual_start,
  actualEnd: row.actual_end,
  scheduledOn: row.scheduled_on,
  startTime: row.start_time,
  endTime: row.end_time,
  endDate: row.end_date,
  duration: row.duration,
  meta: row.meta ? JSON.parse(row.meta) : null,
  isBookmarked: toBoolean(row.is_bookmarked),
  isDeleted: toBoolean(row.is_deleted),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * List changes after the given cursor, across all synced tables, ordered by
 * server_seq. Soft-deleted issues/comments are included (they act as their own
 * tombstones); hard-deleted labels/issue_labels come from sync_tombstones as
 * op:'delete'.
 */
export const listSyncChanges = (
  db: Database.Database,
  since: number,
  limit: number
): SyncChangesPage => {
  const fetch = limit + 1;

  const issueRows = db
    .prepare('SELECT * FROM issues WHERE server_seq > @since ORDER BY server_seq LIMIT @fetch')
    .all({ since, fetch }) as any[];

  const commentRows = db
    .prepare(
      `SELECT c.*, i.uuid AS issue_uuid FROM comments c
       LEFT JOIN issues i ON i.id = c.issue_id
       WHERE c.server_seq > @since ORDER BY c.server_seq LIMIT @fetch`
    )
    .all({ since, fetch }) as any[];

  const labelRows = db
    .prepare('SELECT * FROM labels WHERE server_seq > @since ORDER BY server_seq LIMIT @fetch')
    .all({ since, fetch }) as any[];

  const issueLabelRows = db
    .prepare(
      `SELECT il.*, i.uuid AS issue_uuid, l.name AS label_name FROM issue_labels il
       LEFT JOIN issues i ON i.id = il.issue_id
       LEFT JOIN labels l ON l.id = il.label_id
       WHERE il.server_seq > @since ORDER BY il.server_seq LIMIT @fetch`
    )
    .all({ since, fetch }) as any[];

  const tombstoneRows = db
    .prepare(
      'SELECT * FROM sync_tombstones WHERE server_seq > @since ORDER BY server_seq LIMIT @fetch'
    )
    .all({ since, fetch }) as any[];

  const changes: SyncChange[] = [
    ...issueRows.map((row): SyncChange => ({
      serverSeq: row.server_seq,
      entity: 'issue',
      op: 'upsert',
      data: issueRowToChangeData(row),
    })),
    ...commentRows.map((row): SyncChange => ({
      serverSeq: row.server_seq,
      entity: 'comment',
      op: 'upsert',
      data: {
        id: row.id,
        uuid: row.uuid,
        issueId: row.issue_id,
        issueUuid: row.issue_uuid,
        bodyMd: row.body_md,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isDeleted: toBoolean(row.is_deleted),
      },
    })),
    ...labelRows.map((row): SyncChange => ({
      serverSeq: row.server_seq,
      entity: 'label',
      op: 'upsert',
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        createdAt: row.created_at,
      },
    })),
    ...issueLabelRows.map((row): SyncChange => ({
      serverSeq: row.server_seq,
      entity: 'issue_label',
      op: 'upsert',
      data: {
        issueId: row.issue_id,
        labelId: row.label_id,
        issueUuid: row.issue_uuid,
        labelName: row.label_name,
        assignedAt: row.assigned_at,
      },
    })),
    ...tombstoneRows.map((row): SyncChange => ({
      serverSeq: row.server_seq,
      entity: row.entity as SyncEntity,
      op: 'delete',
      data: {
        ...JSON.parse(row.entity_key),
        deletedAt: row.deleted_at,
      },
    })),
  ];

  changes.sort((a, b) => a.serverSeq - b.serverSeq);
  const page = changes.slice(0, limit);

  return {
    changes: page,
    latestSeq: getLatestSeq(db),
    hasMore: changes.length > limit,
  };
};

/**
 * Find an issue by sync uuid, including soft-deleted rows.
 */
export const findIssueByUuid = (
  db: Database.Database,
  uuid: string
): SyncIssueRecord | null => {
  const row = db.prepare('SELECT * FROM issues WHERE uuid = @uuid').get({ uuid }) as any;
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    uuid: row.uuid,
    type: row.type,
    title: row.title,
    bodyMd: row.body_md,
    status: row.status,
    isBookmarked: toBoolean(row.is_bookmarked),
    isDeleted: toBoolean(row.is_deleted),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    serverSeq: row.server_seq,
  };
};

/**
 * Find a comment by sync uuid, including soft-deleted rows.
 */
export const findCommentByUuid = (
  db: Database.Database,
  uuid: string
): SyncCommentRecord | null => {
  const row = db
    .prepare(
      `SELECT c.*, i.uuid AS issue_uuid FROM comments c
       LEFT JOIN issues i ON i.id = c.issue_id
       WHERE c.uuid = @uuid`
    )
    .get({ uuid }) as any;
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    uuid: row.uuid,
    issueId: row.issue_id,
    issueUuid: row.issue_uuid,
    bodyMd: row.body_md,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDeleted: toBoolean(row.is_deleted),
    serverSeq: row.server_seq,
  };
};

/**
 * Check whether a label is already attached to an issue (idempotent
 * issue_label create detection for sync push).
 */
export const hasIssueLabel = (
  db: Database.Database,
  issueId: number,
  labelId: number
): boolean => {
  const row = db
    .prepare('SELECT 1 FROM issue_labels WHERE issue_id = @issueId AND label_id = @labelId')
    .get({ issueId, labelId });
  return row !== undefined;
};

/**
 * Restore a soft-deleted issue (edit-beats-delete resolution).
 */
export const undeleteIssue = (db: Database.Database, id: number): void => {
  db.prepare('UPDATE issues SET is_deleted = 0, updated_at = @updatedAt WHERE id = @id').run({
    id,
    updatedAt: nowIso(),
  });
};

/**
 * Restore a soft-deleted comment (edit-beats-delete resolution).
 */
export const undeleteComment = (db: Database.Database, id: number): void => {
  db.prepare('UPDATE comments SET is_deleted = 0, updated_at = @updatedAt WHERE id = @id').run({
    id,
    updatedAt: nowIso(),
  });
};

export interface AppliedOpRecord {
  opId: string;
  deviceId: string;
  result: string;
  appliedAt: string;
}

/**
 * Look up a previously applied push operation (idempotency ledger).
 */
export const getAppliedOp = (db: Database.Database, opId: string): AppliedOpRecord | null => {
  const row = db
    .prepare('SELECT * FROM sync_applied_ops WHERE op_id = @opId')
    .get({ opId }) as any;
  if (!row) {
    return null;
  }
  return {
    opId: row.op_id,
    deviceId: row.device_id,
    result: row.result,
    appliedAt: row.applied_at,
  };
};

/**
 * Record the result of an applied push operation.
 */
export const recordAppliedOp = (
  db: Database.Database,
  opId: string,
  deviceId: string,
  result: string
): void => {
  db.prepare(
    `INSERT INTO sync_applied_ops (op_id, device_id, result)
     VALUES (@opId, @deviceId, @result)`
  ).run({ opId, deviceId, result });
};
