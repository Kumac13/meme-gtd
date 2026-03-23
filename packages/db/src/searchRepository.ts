import type Database from 'better-sqlite3';
import type { Comment } from 'meme-gtd-shared';

export interface KeywordMatch {
  field: 'issue' | 'comment';
  commentId: number | null;
  text: string;
}

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
  matches: KeywordMatch[];
}

export interface KeywordSearchOptions {
  types?: string[];
  status?: string;
  labels?: string[];
  bookmarked?: boolean;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
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
  const offset = options.offset ?? 0;
  const order = options.order === 'asc' ? 'ASC' : 'DESC';
  const q = `%${query}%`;

  const typesFilter = options.types && options.types.length > 0
    ? `AND i.type IN (${options.types.map(() => '?').join(', ')})`
    : '';
  const typesParams = options.types ?? [];

  const statusFilter = options.status ? 'AND i.status = ?' : '';
  const statusParams = options.status ? [options.status] : [];

  const labelFilter = options.labels && options.labels.length > 0
    ? `AND i.id IN (SELECT il.issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name IN (${options.labels.map(() => '?').join(', ')}))`
    : '';
  const labelParams = options.labels ?? [];

  const bookmarkedFilter = options.bookmarked ? 'AND i.is_bookmarked = 1' : '';

  const extraFilters = `${typesFilter} ${statusFilter} ${labelFilter} ${bookmarkedFilter}`;
  const extraParams = [...typesParams, ...statusParams, ...labelParams];

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
      ${extraFilters}

      UNION ALL

      SELECT i.id, i.type, i.title, i.body_md, i.status,
             i.is_bookmarked, i.created_at, i.updated_at,
             (SELECT COUNT(*) FROM comments c2 WHERE c2.issue_id = i.id AND c2.is_deleted = 0) AS comment_count,
             'comment' AS match_field, c.id AS match_comment_id,
             c.body_md AS matched_text
      FROM issues i
      JOIN comments c ON c.issue_id = i.id AND c.is_deleted = 0
      WHERE i.is_deleted = 0 AND c.body_md LIKE ?
      ${extraFilters}
    )
    ORDER BY updated_at ${order}
  `;

  const params = [
    q, q, q, ...extraParams,
    q, ...extraParams,
  ];

  const rows = db.prepare(sql).all(...params) as RawSearchRow[];

  // Group by issue id, preserving order of first appearance
  const grouped = new Map<number, { row: RawSearchRow; matches: KeywordMatch[] }>();
  for (const row of rows) {
    const existing = grouped.get(row.id);
    const match: KeywordMatch = {
      field: row.match_field as 'issue' | 'comment',
      commentId: row.match_comment_id,
      text: row.matched_text,
    };
    if (existing) {
      existing.matches.push(match);
    } else {
      grouped.set(row.id, { row, matches: [match] });
    }
  }

  // Apply offset and limit after grouping (per issue, not per match)
  const entries = [...grouped.values()].slice(offset, offset + limit);

  // Batch fetch labels
  const issueIds = entries.map((e) => e.row.id);
  const labelMap = new Map<number, string[]>();
  if (issueIds.length > 0) {
    const placeholders = issueIds.map(() => '?').join(',');
    const labelRows = db
      .prepare(`SELECT il.issue_id, l.name FROM labels l JOIN issue_labels il ON il.label_id = l.id WHERE il.issue_id IN (${placeholders}) ORDER BY l.name`)
      .all(...issueIds) as any[];
    for (const l of labelRows) {
      const list = labelMap.get(l.issue_id) ?? [];
      list.push(l.name);
      labelMap.set(l.issue_id, list);
    }
  }

  return entries.map(({ row, matches }) => ({
    id: row.id,
    type: row.type as 'memo' | 'task' | 'article',
    title: row.title,
    bodyMd: row.body_md,
    status: row.status,
    isBookmarked: row.is_bookmarked === 1,
    labels: labelMap.get(row.id) ?? [],
    commentCount: row.comment_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    matches,
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
