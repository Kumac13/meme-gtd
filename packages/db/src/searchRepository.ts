import type Database from 'better-sqlite3';
import type { Comment } from 'meme-gtd-shared';

export interface KeywordSearchResult {
  id: number;
  type: 'memo' | 'task' | 'article';
  title: string | null;
  bodyMd: string;
  status: string | null;
  isBookmarked: boolean;
  labels: string[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  matchField: 'issue' | 'comment';
  matchCommentId: number | null;
  matchedText: string;
}

export interface KeywordSearchOptions {
  types?: string[];
  limit?: number;
}

interface RawSearchRow {
  id: number;
  type: string;
  title: string | null;
  body_md: string;
  status: string | null;
  is_bookmarked: number;
  created_at: string;
  updated_at: string;
  comment_count: number;
  match_field: string;
  match_comment_id: number | null;
  matched_text: string;
}

export const searchByKeyword = (
  db: Database.Database,
  query: string,
  options: KeywordSearchOptions = {}
): KeywordSearchResult[] => {
  const limit = options.limit ?? 20;
  const q = `%${query}%`;

  const typesFilter = options.types && options.types.length > 0
    ? `AND i.type IN (${options.types.map(() => '?').join(', ')})`
    : '';

  const typesParams = options.types ?? [];

  const sql = `
    SELECT id, type, title, body_md, status, is_bookmarked, created_at, updated_at,
           comment_count, match_field, match_comment_id, matched_text
    FROM (
      SELECT i.id, i.type, i.title, i.body_md, i.status,
             i.is_bookmarked, i.created_at, i.updated_at,
             (SELECT COUNT(*) FROM comments c2 WHERE c2.issue_id = i.id AND c2.is_deleted = 0) AS comment_count,
             'issue' AS match_field, NULL AS match_comment_id,
             CASE WHEN i.title LIKE ? THEN i.title ELSE i.body_md END AS matched_text
      FROM issues i
      WHERE i.is_deleted = 0 AND (i.title LIKE ? OR i.body_md LIKE ?)
      ${typesFilter}

      UNION

      SELECT i.id, i.type, i.title, i.body_md, i.status,
             i.is_bookmarked, i.created_at, i.updated_at,
             (SELECT COUNT(*) FROM comments c2 WHERE c2.issue_id = i.id AND c2.is_deleted = 0) AS comment_count,
             'comment' AS match_field, c.id AS match_comment_id,
             c.body_md AS matched_text
      FROM issues i
      JOIN comments c ON c.issue_id = i.id AND c.is_deleted = 0
      WHERE i.is_deleted = 0 AND c.body_md LIKE ?
      ${typesFilter}
    )
    ORDER BY updated_at DESC
    LIMIT ?
  `;

  const params = [
    q, q, q, ...typesParams,
    q, ...typesParams,
    limit,
  ];

  const rows = db.prepare(sql).all(...params) as RawSearchRow[];

  return rows.map((row) => ({
    id: row.id,
    type: row.type as 'memo' | 'task' | 'article',
    title: row.title,
    bodyMd: row.body_md,
    status: row.status,
    isBookmarked: row.is_bookmarked === 1,
    labels: getIssueLabels(db, row.id),
    commentCount: row.comment_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    matchField: row.match_field as 'issue' | 'comment',
    matchCommentId: row.match_comment_id,
    matchedText: row.matched_text,
  }));
};

export const getIssueLabels = (db: Database.Database, issueId: number): string[] => {
  const rows = db
    .prepare('SELECT l.name FROM labels l JOIN issue_labels il ON il.label_id = l.id WHERE il.issue_id = ? ORDER BY l.name')
    .all(issueId) as Array<{ name: string }>;
  return rows.map((row) => row.name);
};

export const getIssueComments = (db: Database.Database, issueId: number): Comment[] => {
  const rows = db
    .prepare('SELECT * FROM comments WHERE issue_id = ? AND is_deleted = 0 ORDER BY created_at ASC')
    .all(issueId) as any[];
  return rows.map((row) => ({
    id: row.id,
    issueId: row.issue_id,
    bodyMd: row.body_md,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted === 1,
  }));
};
