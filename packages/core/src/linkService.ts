import type { MgtdConfig } from 'meme-gtd-config';
import type { Link } from 'meme-gtd-shared';
import {
  ensureDatabase,
  createLink as dbCreateLink,
  listLinks as dbListLinks,
  deleteLink as dbDeleteLink,
  findLink,
  type CreateLinkInput,
  type ListLinksFilters
} from 'meme-gtd-db';

export interface LinkServiceOptions {
  config: MgtdConfig;
}

export class LinkService {
  private config: MgtdConfig;

  constructor(options: LinkServiceOptions) {
    this.config = options.config;
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
    const db = ensureDatabase(this.config);

    try {
      // Validation 1: Self-reference check
      if (sourceId === targetId) {
        throw new Error(`Cannot link issue to itself (ID: ${sourceId})`);
      }

      // Validation 2: Check if source issue exists
      const sourceStmt = db.prepare('SELECT id FROM issues WHERE id = ? AND is_deleted = 0');
      const sourceExists = sourceStmt.get(sourceId);
      if (!sourceExists) {
        throw new Error(`Issue #${sourceId} not found`);
      }

      // Validation 3: Check if target issue exists
      const targetStmt = db.prepare('SELECT id FROM issues WHERE id = ? AND is_deleted = 0');
      const targetExists = targetStmt.get(targetId);
      if (!targetExists) {
        throw new Error(`Issue #${targetId} not found`);
      }

      // Validation 4: Check for duplicate link
      const existing = findLink(db, {
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

      return dbCreateLink(db, input);
    } finally {
      db.close();
    }
  }

  /**
   * List all links for a given issue
   * @param issueId Issue ID
   * @param filters Optional filters
   * @returns Array of links
   */
  list(issueId: number, filters?: ListLinksFilters): Link[] {
    const db = ensureDatabase(this.config);

    try {
      return dbListLinks(db, issueId, filters);
    } finally {
      db.close();
    }
  }

  /**
   * Remove a link by ID
   * @param linkId Link ID to remove
   * @throws Error if link not found
   */
  remove(linkId: number): void {
    const db = ensureDatabase(this.config);

    try {
      dbDeleteLink(db, linkId);
    } finally {
      db.close();
    }
  }
}
