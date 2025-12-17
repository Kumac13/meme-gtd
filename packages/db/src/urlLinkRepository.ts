import Database from 'better-sqlite3';
import { nowIso, type UrlLink } from 'meme-gtd-shared';

export interface CreateUrlLinkInput {
  issueId: number;
  url: string;
  title?: string | null;
}

export interface UpdateUrlLinkInput {
  title?: string | null;
}

/**
 * Convert database row to UrlLink object
 */
const urlLinkRowToUrlLink = (row: any): UrlLink => ({
  id: row.id,
  issueId: row.issue_id,
  url: row.url,
  title: row.title,
  createdAt: row.created_at,
});

/**
 * Create a new URL link for an issue
 * @param db Database instance
 * @param input URL link creation parameters
 * @returns Created URL link object
 */
export const createUrlLink = (db: Database.Database, input: CreateUrlLinkInput): UrlLink => {
  const now = nowIso();
  const stmt = db.prepare(`
    INSERT INTO url_links (issue_id, url, title, created_at)
    VALUES (@issueId, @url, @title, @createdAt)
  `);

  const result = stmt.run({
    issueId: input.issueId,
    url: input.url,
    title: input.title ?? null,
    createdAt: now,
  });

  return {
    id: result.lastInsertRowid as number,
    issueId: input.issueId,
    url: input.url,
    title: input.title ?? null,
    createdAt: now,
  };
};

/**
 * Get a URL link by its ID
 * @param db Database instance
 * @param urlLinkId URL link ID
 * @returns URL link object
 * @throws Error if URL link not found
 */
export const getUrlLinkById = (db: Database.Database, urlLinkId: number): UrlLink => {
  const stmt = db.prepare('SELECT * FROM url_links WHERE id = @urlLinkId');
  const row = stmt.get({ urlLinkId }) as any | undefined;

  if (!row) {
    throw new Error(`URL link #${urlLinkId} not found`);
  }

  return urlLinkRowToUrlLink(row);
};

/**
 * List all URL links for a given issue
 * @param db Database instance
 * @param issueId Issue ID to find URL links for
 * @returns Array of URL links
 */
export const listUrlLinks = (db: Database.Database, issueId: number): UrlLink[] => {
  const stmt = db.prepare(`
    SELECT * FROM url_links
    WHERE issue_id = @issueId
    ORDER BY created_at ASC
  `);
  const rows = stmt.all({ issueId }) as any[];

  return rows.map(urlLinkRowToUrlLink);
};

/**
 * Delete a URL link by its ID
 * @param db Database instance
 * @param urlLinkId URL link ID to delete
 * @throws Error if URL link not found
 */
export const deleteUrlLink = (db: Database.Database, urlLinkId: number): void => {
  // Verify URL link exists first
  getUrlLinkById(db, urlLinkId);

  const stmt = db.prepare('DELETE FROM url_links WHERE id = @urlLinkId');
  stmt.run({ urlLinkId });
};

/**
 * Update a URL link's title
 * @param db Database instance
 * @param urlLinkId URL link ID to update
 * @param input Update parameters
 * @returns Updated URL link object
 * @throws Error if URL link not found
 */
export const updateUrlLink = (db: Database.Database, urlLinkId: number, input: UpdateUrlLinkInput): UrlLink => {
  // Verify URL link exists first
  getUrlLinkById(db, urlLinkId);

  const stmt = db.prepare(`
    UPDATE url_links
    SET title = @title
    WHERE id = @urlLinkId
  `);

  stmt.run({
    urlLinkId,
    title: input.title ?? null,
  });

  return getUrlLinkById(db, urlLinkId);
};
