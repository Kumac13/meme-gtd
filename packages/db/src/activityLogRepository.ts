import Database from 'better-sqlite3';
import { memoPreviewTitle, nowIso } from 'meme-gtd-shared';
import type {
  ActivityLogEntry,
  CreateActivityLogInput,
  ActivityLogFilters,
  CompletedTaskEntry,
  EventType,
  SourceType,
} from 'meme-gtd-shared';

/**
 * Convert database row to ActivityLogEntry
 */
const rowToActivityLogEntry = (row: any): ActivityLogEntry => ({
  id: row.id,
  eventType: row.event_type as EventType,
  occurredAt: row.occurred_at,
  sourceType: row.source_type as SourceType,
  payload: JSON.parse(row.payload),
  issueId: row.issue_id ?? null,
  projectId: row.project_id ?? null,
  labelId: row.label_id ?? null,
  linkId: row.link_id ?? null,
  commentId: row.comment_id ?? null,
});

/**
 * Create a new activity log entry
 * Note: This is an append-only table, no UPDATE or DELETE operations are provided
 */
export const createActivityLog = (
  db: Database.Database,
  input: CreateActivityLogInput
): ActivityLogEntry => {
  const now = nowIso();
  const payloadJson = JSON.stringify(input.payload);

  const stmt = db.prepare(`
    INSERT INTO activity_log (event_type, occurred_at, source_type, payload)
    VALUES (@eventType, @occurredAt, @sourceType, @payload)
  `);

  const result = stmt.run({
    eventType: input.eventType,
    occurredAt: now,
    sourceType: input.sourceType,
    payload: payloadJson,
  });

  const id = Number(result.lastInsertRowid);

  // Retrieve the created entry to get generated columns
  const getStmt = db.prepare(`
    SELECT id, event_type, occurred_at, source_type, payload,
           issue_id, project_id, label_id, link_id, comment_id
    FROM activity_log
    WHERE id = ?
  `);

  const row = getStmt.get(id);
  return rowToActivityLogEntry(row);
};

/**
 * List activity log entries with optional filters
 */
export const listActivityLog = (
  db: Database.Database,
  filters: ActivityLogFilters = {}
): ActivityLogEntry[] => queryActivityLog(db, filters);

const queryActivityLog = (
  db: Database.Database,
  filters: ActivityLogFilters,
  options: { hideUnlinkedPairs?: boolean } = {}
): ActivityLogEntry[] => {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.issueId !== undefined) {
    conditions.push(
      "(issue_id = @issueId OR (event_type LIKE 'link.%' AND (json_extract(payload, '$.source_issue_id') = @issueId OR json_extract(payload, '$.target_issue_id') = @issueId)))"
    );
    params.issueId = filters.issueId;
  }

  if (filters.projectId !== undefined) {
    conditions.push('project_id = @projectId');
    params.projectId = filters.projectId;
  }

  if (filters.labelId !== undefined) {
    conditions.push('label_id = @labelId');
    params.labelId = filters.labelId;
  }

  if (filters.linkId !== undefined) {
    conditions.push('link_id = @linkId');
    params.linkId = filters.linkId;
  }

  if (filters.commentId !== undefined) {
    conditions.push('comment_id = @commentId');
    params.commentId = filters.commentId;
  }

  if (filters.eventType !== undefined) {
    conditions.push('event_type = @eventType');
    params.eventType = filters.eventType;
  }

  if (filters.sourceType !== undefined) {
    conditions.push('source_type = @sourceType');
    params.sourceType = filters.sourceType;
  }

  if (filters.from !== undefined) {
    conditions.push('occurred_at >= @from');
    params.from = filters.from;
  }

  if (filters.to !== undefined) {
    conditions.push('occurred_at <= @to');
    params.to = filters.to;
  }

  if (options.hideUnlinkedPairs) {
    // 対になる追加・解除は、表示件数を絞る前に履歴全体から照合する。
    conditions.push(`(
      event_type NOT IN ('link.created', 'link.deleted')
      OR NOT EXISTS (
        SELECT 1 FROM activity_log AS counterpart
        WHERE counterpart.link_id = activity_log.link_id
          AND counterpart.event_type = CASE activity_log.event_type
            WHEN 'link.created' THEN 'link.deleted'
            WHEN 'link.deleted' THEN 'link.created'
          END
      )
    )`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = filters.order === 'asc' ? 'ASC' : 'DESC';
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  const sql = `
    SELECT id, event_type, occurred_at, source_type, payload,
           issue_id, project_id, label_id, link_id, comment_id
    FROM activity_log
    ${whereClause}
    ORDER BY occurred_at ${order}, id ${order}
    LIMIT @limit OFFSET @offset
  `;

  const stmt = db.prepare(sql);
  const rows = stmt.all({ ...params, limit, offset });

  const entries = rows.map(rowToActivityLogEntry);
  // 旧ログにはメモのタイトルがないため、取得したページ分だけまとめて補う。
  const missing: Array<{ payload: Record<string, unknown>; key: string; id: number }> = [];
  for (const { eventType, payload } of entries) {
    if (eventType !== 'link.created' && eventType !== 'link.deleted') continue;
    for (const side of ['source', 'target']) {
      const key = side + '_issue_title';
      const id = payload[side + '_issue_id'];
      if (payload[side + '_issue_type'] === 'memo' && payload[key] == null && typeof id === 'number') {
        missing.push({ payload, key, id });
      }
    }
  }
  if (missing.length) {
    const ids = [...new Set(missing.map(({ id }) => id))];
    const memos = db.prepare(`
      SELECT id, body_md FROM issues WHERE type = 'memo' AND id IN (SELECT value FROM json_each(?))
    `).all(JSON.stringify(ids)) as Array<{ id: number; body_md: string }>;
    const previews = new Map(memos.map(memo => [memo.id, memoPreviewTitle(memo.body_md ?? '')]));
    for (const { payload, key, id } of missing) {
      if (previews.has(id)) payload[key] = previews.get(id);
    }
  }
  return entries;
};

/**
 * Get activity log entries for a specific issue
 */
export const getByIssueId = (
  db: Database.Database,
  issueId: number,
  options: { limit?: number; order?: 'asc' | 'desc' } = {}
): ActivityLogEntry[] => {
  return queryActivityLog(
    db,
    { issueId, limit: options.limit, order: options.order ?? 'asc' },
    { hideUnlinkedPairs: true }
  );
};

/**
 * Get activity log entries for a specific project
 */
export const getByProjectId = (
  db: Database.Database,
  projectId: number,
  options: { limit?: number; order?: 'asc' | 'desc' } = {}
): ActivityLogEntry[] => {
  return listActivityLog(db, {
    projectId,
    limit: options.limit,
    order: options.order ?? 'desc',
  });
};

/**
 * Get completed tasks for a date range
 */
export const getCompletedTasks = (
  db: Database.Database,
  options: { from?: string; to?: string; limit?: number } = {}
): CompletedTaskEntry[] => {
  // Default to today if not specified
  const today = new Date().toISOString().split('T')[0];
  const fromDate = options.from ?? today;
  const toDate = options.to ?? today;
  const limit = options.limit ?? 100;

  const sql = `
    SELECT
      json_extract(payload, '$.issue_id') as task_id,
      json_extract(payload, '$.title') as title,
      occurred_at as completed_at,
      json_extract(payload, '$.project_snapshot') as project_snapshot,
      json_extract(payload, '$.label_snapshot') as label_snapshot
    FROM activity_log
    WHERE event_type = 'task.status_changed'
      AND json_extract(payload, '$.to_status') = 'done'
      AND date(occurred_at) >= date(@fromDate)
      AND date(occurred_at) <= date(@toDate)
    ORDER BY occurred_at DESC
    LIMIT @limit
  `;

  const stmt = db.prepare(sql);
  const rows = stmt.all({ fromDate, toDate, limit });

  return rows.map((row: any) => ({
    taskId: row.task_id,
    title: row.title,
    completedAt: row.completed_at,
    projectSnapshot: row.project_snapshot ? JSON.parse(row.project_snapshot) : undefined,
    labelSnapshot: row.label_snapshot ? JSON.parse(row.label_snapshot) : undefined,
  }));
};
