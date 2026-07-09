import Database from "better-sqlite3";
import { nowIso, uuidv7, type Comment, type Highlight, toBoolean } from "meme-gtd-shared";

export interface CreateHighlightInput {
  issueId: number;
  exact: string;
  prefix?: string;
  suffix?: string;
  color?: string;
  // Sync apply path (POST /api/sync/push): client-minted identity and
  // preserved offline timestamps.
  uuid?: string;
  createdAt?: string;
}

const highlightRowToHighlight = (row: any): Highlight => ({
  id: row.id,
  uuid: row.uuid ?? undefined,
  serverSeq: row.server_seq != null ? Number(row.server_seq) : undefined,
  issueId: row.issue_id,
  exact: row.exact,
  ...(row.prefix != null && { prefix: row.prefix }),
  ...(row.suffix != null && { suffix: row.suffix }),
  color: row.color,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isDeleted: toBoolean(row.is_deleted),
  commentCount: Number(row.comment_count ?? 0),
});

const commentRowToComment = (row: any): Comment => ({
  id: row.id,
  uuid: row.uuid,
  serverSeq: row.server_seq,
  issueId: row.issue_id,
  ...(row.highlight_id != null && { highlightId: row.highlight_id }),
  bodyMd: row.body_md,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isDeleted: toBoolean(row.is_deleted),
});

export const createHighlight = (db: Database.Database, input: CreateHighlightInput): Highlight => {
  const now = input.createdAt ?? nowIso();
  const result = db
    .prepare(
      `INSERT INTO highlights (uuid, issue_id, exact, prefix, suffix, color, created_at, updated_at, is_deleted)
       VALUES (@uuid, @issueId, @exact, @prefix, @suffix, @color, @createdAt, @createdAt, 0)`
    )
    .run({
      uuid: input.uuid ?? uuidv7(),
      issueId: input.issueId,
      exact: input.exact,
      prefix: input.prefix ?? null,
      suffix: input.suffix ?? null,
      color: input.color ?? "green",
      createdAt: now,
    });

  return getHighlight(db, Number(result.lastInsertRowid));
};

export const getHighlight = (db: Database.Database, id: number): Highlight => {
  const row = db
    .prepare(
      `SELECT h.*,
        (SELECT COUNT(*) FROM comments c WHERE c.highlight_id = h.id AND c.is_deleted = 0) as comment_count
       FROM highlights h WHERE h.id = @id AND h.is_deleted = 0`
    )
    .get({ id });
  if (!row) {
    throw new Error(`Highlight not found: ${id}`);
  }
  return highlightRowToHighlight(row);
};

export const listHighlights = (db: Database.Database, issueId: number): Highlight[] => {
  const rows = db
    .prepare(
      `SELECT h.*,
        (SELECT COUNT(*) FROM comments c WHERE c.highlight_id = h.id AND c.is_deleted = 0) as comment_count
       FROM highlights h
       WHERE h.issue_id = @issueId AND h.is_deleted = 0
       ORDER BY h.created_at ASC`
    )
    .all({ issueId });
  return rows.map(highlightRowToHighlight);
};

export const deleteHighlight = (db: Database.Database, id: number): void => {
  const result = db
    .prepare("UPDATE highlights SET is_deleted = 1, updated_at = @updatedAt WHERE id = @id AND is_deleted = 0")
    .run({ id, updatedAt: nowIso() });
  if (result.changes === 0) {
    throw new Error(`Highlight not found: ${id}`);
  }
};

// --- Highlight comments -----------------------------------------------------
// Reuse the shared comments table (issue_id = article, highlight_id = highlight).
// update/delete go through memoRepository's updateComment/deleteComment since
// those operate on commentId alone; only create/list need highlight awareness.

export const addHighlightComment = (
  db: Database.Database,
  issueId: number,
  highlightId: number,
  bodyMd: string,
  options?: { uuid?: string; createdAt?: string }
): Comment => {
  const now = options?.createdAt ?? nowIso();
  const result = db
    .prepare(
      `INSERT INTO comments (uuid, issue_id, highlight_id, body_md, created_at, updated_at, is_deleted)
       VALUES (@uuid, @issueId, @highlightId, @bodyMd, @createdAt, @createdAt, 0)`
    )
    .run({ uuid: options?.uuid ?? uuidv7(), issueId, highlightId, bodyMd, createdAt: now });

  return commentRowToComment(
    db.prepare("SELECT * FROM comments WHERE id = @id").get({ id: result.lastInsertRowid })
  );
};

export const listHighlightComments = (db: Database.Database, highlightId: number): Comment[] => {
  const rows = db
    .prepare(
      "SELECT * FROM comments WHERE highlight_id = @highlightId AND is_deleted = 0 ORDER BY created_at ASC"
    )
    .all({ highlightId });
  return rows.map(commentRowToComment);
};
