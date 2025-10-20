import Database from 'better-sqlite3';
import { nowIso, type Link } from 'meme-gtd-shared';

export interface CreateLinkInput {
  sourceIssueId: number;
  targetIssueId: number;
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';
}

export interface ListLinksFilters {
  type?: 'parent' | 'child' | 'relates' | 'derived_from';
}

/**
 * Convert database row to Link object
 */
const linkRowToLink = (row: any): Link => ({
  id: row.id,
  sourceIssueId: row.source_issue_id,
  targetIssueId: row.target_issue_id,
  linkType: row.link_type as 'parent' | 'child' | 'relates' | 'derived_from',
  createdAt: row.created_at,
});

/**
 * Create a new link between two issues
 * @param db Database instance
 * @param input Link creation parameters
 * @returns Created link object
 */
export const createLink = (db: Database.Database, input: CreateLinkInput): Link => {
  const now = nowIso();
  const stmt = db.prepare(`
    INSERT INTO links (source_issue_id, target_issue_id, link_type, created_at)
    VALUES (@sourceIssueId, @targetIssueId, @linkType, @createdAt)
  `);

  const result = stmt.run({
    sourceIssueId: input.sourceIssueId,
    targetIssueId: input.targetIssueId,
    linkType: input.linkType,
    createdAt: now,
  });

  return {
    id: result.lastInsertRowid as number,
    sourceIssueId: input.sourceIssueId,
    targetIssueId: input.targetIssueId,
    linkType: input.linkType,
    createdAt: now,
  };
};

/**
 * Get a link by its ID
 * @param db Database instance
 * @param linkId Link ID
 * @returns Link object
 * @throws Error if link not found
 */
export const getLinkById = (db: Database.Database, linkId: number): Link => {
  const stmt = db.prepare('SELECT * FROM links WHERE id = @linkId');
  const row = stmt.get({ linkId }) as any | undefined;

  if (!row) {
    throw new Error(`Link #${linkId} not found`);
  }

  return linkRowToLink(row);
};

/**
 * List all links for a given issue (both incoming and outgoing)
 * @param db Database instance
 * @param issueId Issue ID to find links for
 * @param filters Optional filters (e.g., link type)
 * @returns Array of links
 */
export const listLinks = (
  db: Database.Database,
  issueId: number,
  filters?: ListLinksFilters
): Link[] => {
  let sql = `
    SELECT * FROM links
    WHERE (source_issue_id = @issueId OR target_issue_id = @issueId)
  `;

  const params: any = { issueId };

  if (filters?.type) {
    sql += ' AND link_type = @linkType';
    params.linkType = filters.type;
  }

  sql += ' ORDER BY created_at ASC';

  const stmt = db.prepare(sql);
  const rows = stmt.all(params) as any[];

  return rows.map(linkRowToLink);
};

/**
 * Delete a link by its ID
 * @param db Database instance
 * @param linkId Link ID to delete
 * @throws Error if link not found
 */
export const deleteLink = (db: Database.Database, linkId: number): void => {
  // Verify link exists first
  getLinkById(db, linkId);

  const stmt = db.prepare('DELETE FROM links WHERE id = @linkId');
  stmt.run({ linkId });
};

/**
 * Find a link matching specific criteria (for duplicate checking)
 * @param db Database instance
 * @param criteria Link search criteria
 * @returns Link object or null if not found
 */
export const findLink = (
  db: Database.Database,
  criteria: Partial<CreateLinkInput>
): Link | null => {
  const conditions: string[] = [];
  const params: any = {};

  if (criteria.sourceIssueId !== undefined) {
    conditions.push('source_issue_id = @sourceIssueId');
    params.sourceIssueId = criteria.sourceIssueId;
  }

  if (criteria.targetIssueId !== undefined) {
    conditions.push('target_issue_id = @targetIssueId');
    params.targetIssueId = criteria.targetIssueId;
  }

  if (criteria.linkType !== undefined) {
    conditions.push('link_type = @linkType');
    params.linkType = criteria.linkType;
  }

  if (conditions.length === 0) {
    return null;
  }

  const sql = `SELECT * FROM links WHERE ${conditions.join(' AND ')} LIMIT 1`;
  const stmt = db.prepare(sql);
  const row = stmt.get(params) as any | undefined;

  return row ? linkRowToLink(row) : null;
};
