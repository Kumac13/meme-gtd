import type { MgtdConfig } from 'meme-gtd-config';
import type { Link } from 'meme-gtd-shared';
import type Database from 'better-sqlite3';
import {
  ensureDatabase,
  createLink as dbCreateLink,
  listLinks as dbListLinks,
  deleteLink as dbDeleteLink,
  findLink,
  getLinkById as dbGetLinkById,
  type CreateLinkInput,
  type ListLinksFilters
} from 'meme-gtd-db';

export interface LinkServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
}

export class LinkService {
  private readonly db: Database.Database;

  constructor(private readonly options: LinkServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('LinkService requires either db or config option');
    }
  }

  /**
   * Create a new link with validation
   * @param sourceId Source issue ID
   * @param targetId Target issue ID
   * @param type Link type
   * @returns Created link
   * @throws Error if validation fails
   */
  create(
    sourceId: number,
    targetId: number,
    type: 'parent' | 'child' | 'relates' | 'derived_from'
  ): Link {
    // Validation 1: Self-reference check
    if (sourceId === targetId) {
      throw new Error(`Cannot link issue to itself (ID: ${sourceId})`);
    }

    // Validation 2: Check if source issue exists
    const sourceStmt = this.db.prepare('SELECT id FROM issues WHERE id = ? AND is_deleted = 0');
    const sourceExists = sourceStmt.get(sourceId);
    if (!sourceExists) {
      throw new Error(`Issue #${sourceId} not found`);
    }

    // Validation 3: Check if target issue exists
    const targetStmt = this.db.prepare('SELECT id FROM issues WHERE id = ? AND is_deleted = 0');
    const targetExists = targetStmt.get(targetId);
    if (!targetExists) {
      throw new Error(`Issue #${targetId} not found`);
    }

    // Validation 4: Check for duplicate link
    const existing = findLink(this.db, {
      sourceIssueId: sourceId,
      targetIssueId: targetId,
      linkType: type
    });

    if (existing) {
      throw new Error(
        `Link already exists (source: ${sourceId}, target: ${targetId}, type: ${type})`
      );
    }

    // Create the link
    const input: CreateLinkInput = {
      sourceIssueId: sourceId,
      targetIssueId: targetId,
      linkType: type
    };

    return dbCreateLink(this.db, input);
  }

  /**
   * Get a link by ID
   * @param linkId Link ID
   * @returns Link
   * @throws Error if link not found
   */
  getById(linkId: number): Link {
    return dbGetLinkById(this.db, linkId);
  }

  /**
   * List all links for a given issue
   * @param issueId Issue ID
   * @param filters Optional filters
   * @returns Array of links
   */
  list(issueId: number, filters?: ListLinksFilters): Link[] {
    return dbListLinks(this.db, issueId, filters);
  }

  /**
   * Remove a link by ID
   * @param linkId Link ID to remove
   * @throws Error if link not found
   */
  remove(linkId: number): void {
    dbDeleteLink(this.db, linkId);
  }
}
