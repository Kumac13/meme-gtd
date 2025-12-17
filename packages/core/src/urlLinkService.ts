import type { MgtdConfig } from 'meme-gtd-config';
import type { UrlLink, SourceType } from 'meme-gtd-shared';
import type Database from 'better-sqlite3';
import {
  ensureDatabase,
  createUrlLink as dbCreateUrlLink,
  listUrlLinks as dbListUrlLinks,
  deleteUrlLink as dbDeleteUrlLink,
  getUrlLinkById as dbGetUrlLinkById,
  updateUrlLink as dbUpdateUrlLink,
  type CreateUrlLinkInput,
  type UpdateUrlLinkInput
} from 'meme-gtd-db';

export interface UrlLinkServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
  sourceType?: SourceType;
}

export class UrlLinkService {
  private readonly db: Database.Database;

  constructor(private readonly options: UrlLinkServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('UrlLinkService requires either db or config option');
    }
  }

  /**
   * Create a new URL link for an issue
   * @param issueId Issue ID to attach the URL to
   * @param url URL string
   * @param title Optional display title
   * @returns Created URL link
   * @throws Error if issue not found
   */
  create(issueId: number, url: string, title?: string | null): UrlLink {
    return this.db.transaction(() => {
      // Validation: Check if issue exists
      const stmt = this.db.prepare('SELECT id FROM issues WHERE id = ? AND is_deleted = 0');
      const issueExists = stmt.get(issueId);
      if (!issueExists) {
        throw new Error(`Issue #${issueId} not found`);
      }

      // Create the URL link
      const input: CreateUrlLinkInput = {
        issueId,
        url,
        title: title ?? null
      };

      return dbCreateUrlLink(this.db, input);
    })();
  }

  /**
   * Get a URL link by ID
   * @param urlLinkId URL link ID
   * @returns URL link
   * @throws Error if URL link not found
   */
  getById(urlLinkId: number): UrlLink {
    return dbGetUrlLinkById(this.db, urlLinkId);
  }

  /**
   * List all URL links for a given issue
   * @param issueId Issue ID
   * @returns Array of URL links
   * @throws Error if issue not found
   */
  list(issueId: number): UrlLink[] {
    // Validation: Check if issue exists
    const stmt = this.db.prepare('SELECT id FROM issues WHERE id = ? AND is_deleted = 0');
    const issueExists = stmt.get(issueId);
    if (!issueExists) {
      throw new Error(`Issue #${issueId} not found`);
    }

    return dbListUrlLinks(this.db, issueId);
  }

  /**
   * Remove a URL link by ID
   * @param urlLinkId URL link ID to remove
   * @throws Error if URL link not found
   */
  remove(urlLinkId: number): void {
    dbDeleteUrlLink(this.db, urlLinkId);
  }

  /**
   * Update a URL link's title
   * @param urlLinkId URL link ID to update
   * @param title New title (or null to clear)
   * @returns Updated URL link
   * @throws Error if URL link not found
   */
  update(urlLinkId: number, title: string | null): UrlLink {
    const input: UpdateUrlLinkInput = { title };
    return dbUpdateUrlLink(this.db, urlLinkId, input);
  }
}
