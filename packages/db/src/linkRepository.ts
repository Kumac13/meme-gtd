import Database from 'better-sqlite3';
import { nowIso, type Link } from 'meme-gtd-shared';
import { keywordCommentMatch, keywordIssueMatch } from './searchRepository.js';

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

/**
 * Find inverse parent-child link (for FR-014 validation)
 * Checks if there's a parent/child link in either direction between two issues
 * @param db Database instance
 * @param sourceId Source issue ID
 * @param targetId Target issue ID
 * @param proposedType The type of link being created
 * @returns Link object if inverse parent-child link exists, null otherwise
 */
export const findInverseParentChildLink = (
  db: Database.Database,
  sourceId: number,
  targetId: number,
  proposedType: 'parent' | 'child' | 'relates' | 'derived_from'
): Link | null => {
  // Only check for parent/child link types
  if (proposedType !== 'parent' && proposedType !== 'child') {
    return null;
  }

  const sql = `
    SELECT * FROM links
    WHERE (
      (source_issue_id = @targetId AND target_issue_id = @sourceId) OR
      (source_issue_id = @sourceId AND target_issue_id = @targetId)
    )
    AND link_type IN ('parent', 'child')
    AND NOT (source_issue_id = @sourceId AND target_issue_id = @targetId AND link_type = @proposedType)
    LIMIT 1
  `;

  const stmt = db.prepare(sql);
  const row = stmt.get({
    sourceId,
    targetId,
    proposedType,
  }) as any | undefined;

  return row ? linkRowToLink(row) : null;
};

/**
 * Check if ancestorId is an ancestor of descendantId (for FR-013 circular detection)
 * Uses recursive CTE to traverse parent-child hierarchy upward from descendant
 * @param db Database instance
 * @param descendantId ID of the descendant issue
 * @param ancestorId ID to check if it's an ancestor
 * @returns true if ancestorId is found in the ancestor chain, false otherwise
 */
export const hasAncestor = (
  db: Database.Database,
  descendantId: number,
  ancestorId: number
): boolean => {
  const sql = `
    WITH RECURSIVE ancestors(issue_id, depth) AS (
      -- Base case: start from the descendant issue
      SELECT @descendantId as issue_id, 0 as depth

      UNION ALL

      -- Recursive case: find ancestors by following parent/child links upward
      -- For 'parent' links: source --parent--> target means source is parent of target
      --   If current issue is TARGET, then SOURCE is the parent
      -- For 'child' links: source --child--> target means source is child of target (i.e., target is parent)
      --   If current issue is SOURCE, then TARGET is the parent
      SELECT
        CASE
          WHEN l.link_type = 'parent' AND l.target_issue_id = a.issue_id THEN l.source_issue_id
          WHEN l.link_type = 'child' AND l.source_issue_id = a.issue_id THEN l.target_issue_id
        END as issue_id,
        a.depth + 1
      FROM ancestors a
      JOIN links l ON (
        (l.link_type = 'parent' AND l.target_issue_id = a.issue_id) OR
        (l.link_type = 'child' AND l.source_issue_id = a.issue_id)
      )
      WHERE a.depth < 10  -- Prevent infinite loops and limit depth
        AND issue_id IS NOT NULL
    )
    SELECT COUNT(*) as count FROM ancestors WHERE issue_id = @ancestorId
  `;

  const stmt = db.prepare(sql);
  const result = stmt.get({
    descendantId,
    ancestorId,
  }) as { count: number };

  return result.count > 0;
};

type GraphIssueType = 'task' | 'memo' | 'article';

export interface LinkGraphFilters {
  rootId?: number;
  depth?: number;
  q?: string;
  labels?: string[];
  projectIds?: number[];
  unassigned?: boolean;
  bookmarked?: boolean;
  includeLabels?: boolean;
}

interface GraphNodeRow {
  id: number;
  type: GraphIssueType;
  title: string | null;
  status: string | null;
}

type GraphEdge = Pick<Link, 'id' | 'sourceIssueId' | 'targetIssueId' | 'linkType'>;

const activeGraphIssue = (alias: 'i' | 'source' | 'target') =>
  `${alias}.is_deleted = 0 AND ${alias}.type IN ('task', 'memo', 'article')`;

export function graphRootExists(db: Database.Database, rootId: number): boolean {
  return Boolean(db.prepare(`SELECT i.id FROM issues i WHERE i.id = ? AND ${activeGraphIssue('i')}`).get(rootId));
}

export function getGraphAdjacency(db: Database.Database): Iterable<{ sourceId: number; targetId: number }> {
  return db.prepare(`
    SELECT l.source_issue_id AS sourceId, l.target_issue_id AS targetId
    FROM links l
    JOIN issues source ON source.id = l.source_issue_id AND ${activeGraphIssue('source')}
    JOIN issues target ON target.id = l.target_issue_id AND ${activeGraphIssue('target')}
  `).iterate() as Iterable<{ sourceId: number; targetId: number }>;
}

export function getGraphNodes(
  db: Database.Database,
  filters: LinkGraphFilters,
  orderedIds: number[] | undefined,
  limit: number,
): GraphNodeRow[] {
  const conditions: string[] = [];
  const params: Record<string, string | number> = { limit };

  if (filters.q) {
    params.q = `%${filters.q}%`;
    conditions.push(`(${keywordIssueMatch('i', '@q')} OR i.id IN (
      SELECT c.issue_id FROM comments c WHERE ${keywordCommentMatch('c', '@q')}
    ))`);
  }
  if (filters.labels?.length) {
    params.labels = JSON.stringify(filters.labels);
    conditions.push(`i.id IN (
      SELECT il.issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id
      WHERE l.name IN (SELECT value FROM json_each(@labels))
    )`);
  }
  const projectConditions: string[] = [];
  if (filters.projectIds?.length) {
    params.projects = JSON.stringify(filters.projectIds);
    projectConditions.push(`i.id IN (
      SELECT issue_id FROM project_items WHERE project_id IN (SELECT value FROM json_each(@projects))
    )`);
  }
  if (filters.unassigned) {
    projectConditions.push('i.id NOT IN (SELECT issue_id FROM project_items)');
  }
  if (projectConditions.length) conditions.push(`(${projectConditions.join(' OR ')})`);
  if (filters.bookmarked) conditions.push('i.is_bookmarked = 1');

  let candidates = '';
  if (orderedIds) {
    candidates = 'JOIN json_each(@orderedIds) AS candidates ON i.id = candidates.value';
    params.orderedIds = JSON.stringify(orderedIds);
  }
  if (filters.rootId !== undefined && conditions.length) {
    params.rootId = filters.rootId;
  }
  const filter = conditions.length
    ? `AND (${filters.rootId !== undefined ? 'i.id = @rootId OR ' : ''}(${conditions.join(' AND ')}))`
    : '';
  return db.prepare(`
    WITH chosen AS MATERIALIZED (
      SELECT i.id, ${orderedIds ? 'candidates.key' : 'i.updated_at'} AS sort_key
      FROM issues i
      ${candidates}
      WHERE ${activeGraphIssue('i')} ${filter}
      ORDER BY sort_key ${orderedIds ? 'ASC' : 'DESC'}, i.id ASC
      LIMIT @limit
    )
    SELECT i.id, i.type,
      CASE WHEN i.type = 'memo' THEN i.body_md ELSE i.title END AS title, i.status
    FROM chosen JOIN issues i ON i.id = chosen.id
    ORDER BY chosen.sort_key ${orderedIds ? 'ASC' : 'DESC'}, i.id ASC
  `).all(params) as GraphNodeRow[];
}

export function getGraphEdges(db: Database.Database, issueIds: string, limit: number): GraphEdge[] {
  return db.prepare(`
    WITH selected(id) AS MATERIALIZED (SELECT value FROM json_each(@issueIds))
    SELECT id, source_issue_id AS sourceIssueId, target_issue_id AS targetIssueId, link_type AS linkType
    FROM links
    WHERE source_issue_id IN (SELECT id FROM selected) AND target_issue_id IN (SELECT id FROM selected)
    ORDER BY id
    LIMIT @limit
  `).all({ issueIds, limit }) as GraphEdge[];
}

export function getGraphLabels(db: Database.Database, issueIds: string, limit: number) {
  return db.prepare(`
    SELECT id, name FROM labels
    WHERE id IN (
      SELECT label_id FROM issue_labels WHERE issue_id IN (SELECT value FROM json_each(@issueIds))
    )
    ORDER BY id
    LIMIT @limit
  `).all({ issueIds, limit }) as Array<{ id: number; name: string }>;
}

export function getGraphMemberships(db: Database.Database, issueIds: string, labelIds: string, limit: number) {
  return db.prepare(`
    WITH assigned AS MATERIALIZED (
      SELECT issue_id, label_id FROM issue_labels
      WHERE issue_id IN (SELECT value FROM json_each(@issueIds))
    )
    SELECT issue_id AS issueId, label_id AS labelId FROM assigned
    WHERE label_id IN (SELECT value FROM json_each(@labelIds))
    ORDER BY label_id, issue_id
    LIMIT @limit
  `).all({ issueIds, labelIds, limit }) as Array<{ issueId: number; labelId: number }>;
}
