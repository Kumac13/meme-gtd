import type { MgtdConfig } from 'meme-gtd-config';
import type { Link, SourceType, TaskStatus } from 'meme-gtd-shared';
import type Database from 'better-sqlite3';
import { ActivityLogger } from './activity-log/activity-logger.js';
import {
  ensureDatabase,
  createLink as dbCreateLink,
  listLinks as dbListLinks,
  deleteLink as dbDeleteLink,
  findLink,
  findInverseParentChildLink,
  hasAncestor,
  getLinkById as dbGetLinkById,
  type CreateLinkInput,
  type ListLinksFilters
} from 'meme-gtd-db';

export interface LinkServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
  sourceType?: SourceType;
}

export class LinkService {
  private readonly db: Database.Database;
  private readonly logger: ActivityLogger;

  constructor(private readonly options: LinkServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('LinkService requires either db or config option');
    }
    this.logger = new ActivityLogger(this.db, options.sourceType ?? 'api');
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
    return this.db.transaction(() => {
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

      // Validation 5: Check for inverse parent-child link (FR-014)
      // Only applies to parent/child link types
      // MUST run before circular check to provide more specific error for 2-node inverse cases
      const inverseLink = findInverseParentChildLink(this.db, sourceId, targetId, type);
      if (inverseLink) {
        throw new Error(
          `Cannot create inverse parent-child link: Issue #${inverseLink.targetIssueId} is already a ${inverseLink.linkType} of Issue #${inverseLink.sourceIssueId}`
        );
      }

      // Validation 6: Check for circular parent-child hierarchy (FR-013)
      // Only applies to parent/child link types
      // Runs after inverse check - catches 3+ node cycles that inverse check doesn't cover
      if (type === 'parent' || type === 'child') {
        // Determine which issue would become the ancestor and which the descendant
        let newAncestorId: number;
        let newDescendantId: number;

        if (type === 'parent') {
          // source --parent--> target means source is parent of target
          newAncestorId = sourceId;
          newDescendantId = targetId;
        } else {
          // type === 'child': source --child--> target means source is child of target
          newAncestorId = targetId;
          newDescendantId = sourceId;
        }

        // Check if newAncestor is already a descendant of newDescendant (would create cycle)
        // hasAncestor(descendantId, ancestorId) checks if ancestorId is an ancestor of descendantId
        // We want to check if newAncestorId has newDescendantId as an ancestor
        if (hasAncestor(this.db, newAncestorId, newDescendantId)) {
          throw new Error(
            `Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy (Issue #${newDescendantId} is already an ancestor of Issue #${newAncestorId})`
          );
        }
      }

      // Create the link
      const input: CreateLinkInput = {
        sourceIssueId: sourceId,
        targetIssueId: targetId,
        linkType: type
      };

      const link = dbCreateLink(this.db, input);
      this.logger.logLinkCreated(link.id, type, sourceId, targetId);

      // Record memo.promoted when a memo is promoted to a task.
      // Both the CLI and Web promote flows converge on creating a
      // task -> memo `derived_from` link, so this is the single place
      // that reliably observes a promotion (Issue #245).
      if (type === 'derived_from') {
        this.maybeLogMemoPromoted(sourceId, targetId, link.id);
      }

      return link;
    })();
  }

  /**
   * Emit a `memo.promoted` event when a newly-created `derived_from` link
   * represents a memo→task promotion (source is a task, target is a memo).
   * No-op for any other `derived_from` link so it never double-logs.
   */
  private maybeLogMemoPromoted(
    sourceId: number,
    targetId: number,
    linkId: number
  ): void {
    const stmt = this.db.prepare(
      'SELECT type, title, status, body_md FROM issues WHERE id = ?'
    );
    const source = stmt.get(sourceId) as
      | { type: string; title: string | null; status: string | null; body_md: string }
      | undefined;
    const target = stmt.get(targetId) as
      | { type: string; title: string | null; status: string | null; body_md: string }
      | undefined;

    if (source?.type !== 'task' || target?.type !== 'memo') {
      return;
    }

    this.logger.logMemoPromoted(
      targetId,
      target.body_md,
      sourceId,
      source.title ?? '',
      source.status as TaskStatus,
      linkId
    );
  }

  /**
   * Create a link, or silently return the existing one if a duplicate would be
   * created. Used for auto-generated mention links where idempotency matters.
   *
   * For `relates`, an existing link in the opposite direction is treated as
   * equivalent (since `A relates B` and `B relates A` mean the same thing),
   * so the new row is skipped and the existing one is returned — avoiding
   * the "two arrows for one relationship" duplication in the UI.
   *
   * Any other validation failure (self-reference, missing issue, etc.) still
   * throws so the caller is forced to filter inputs upstream.
   */
  createOrIgnore(
    sourceId: number,
    targetId: number,
    type: 'parent' | 'child' | 'relates' | 'derived_from'
  ): Link | null {
    if (type === 'relates') {
      const inverse = findLink(this.db, {
        sourceIssueId: targetId,
        targetIssueId: sourceId,
        linkType: 'relates'
      });
      if (inverse) return inverse;
    }
    try {
      return this.create(sourceId, targetId, type);
    } catch (e) {
      if (e instanceof Error && /^Link already exists/.test(e.message)) {
        return findLink(this.db, {
          sourceIssueId: sourceId,
          targetIssueId: targetId,
          linkType: type
        });
      }
      throw e;
    }
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
    this.db.transaction(() => {
      // Get link details before delete for logging
      const link = dbGetLinkById(this.db, linkId);
      this.logger.logLinkDeleted(linkId, link.linkType, link.sourceIssueId, link.targetIssueId);
      dbDeleteLink(this.db, linkId);
    })();
  }
}
