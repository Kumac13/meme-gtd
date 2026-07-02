import Database from 'better-sqlite3';
import { ensureDatabase } from 'meme-gtd-db';
import type { MgtdConfig } from 'meme-gtd-config';
import { nowIso, uuidv7, type SourceType } from 'meme-gtd-shared';
import {
  findCommentByUuid,
  findIssueByUuid,
  getAppliedOp,
  getLatestSeq,
  listSyncChanges,
  recordAppliedOp,
  undeleteComment,
  undeleteIssue,
  type SyncChangesPage
} from 'meme-gtd-db';
import { MemoService } from './index.js';

export interface SyncServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
  sourceType?: SourceType;
}

export interface SyncPushOperation {
  opId: string;
  entity: 'memo' | 'comment';
  type: 'create' | 'update' | 'delete';
  uuid: string;
  /** Parent issue uuid (comment operations only). */
  issueUuid?: string;
  /** The server updatedAt this edit was based on; null when unknown. */
  baseUpdatedAt?: string | null;
  payload?: {
    bodyMd?: string;
    isBookmarked?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };
}

export type SyncPushStatus = 'applied' | 'alreadyApplied' | 'conflictCopied' | 'skipped';

export interface SyncPushOperationResult {
  opId: string;
  status: SyncPushStatus;
  uuid: string;
  serverId?: number;
  updatedAt?: string;
  conflictCopyUuid?: string;
}

export interface SyncPushResult {
  results: SyncPushOperationResult[];
  latestSeq: number;
}

/**
 * Server-side sync semantics for iOS offline support (Phase 2).
 *
 * Conflict rules (docs/architecture.md 同期アーキテクチャ):
 * - Ordering authority is server_seq; updatedAt is compared for EQUALITY only
 *   (never ordered) to sidestep clock skew and second-vs-millisecond precision.
 * - Last-write-wins per record, EXCEPT concurrent memo body edits, which keep
 *   the server version and save the client version as a "conflicted copy"
 *   memo (Joplin-style duplicate-on-conflict — no data loss).
 * - Edit beats delete in both directions: updating a soft-deleted row
 *   resurrects it; deleting a row edited since the client's base is skipped.
 * - Idempotency: every operation carries a client-minted opId; replays return
 *   the recorded result (applied -> alreadyApplied).
 *
 * All mutations go through MemoService so the activity log stays complete.
 */
export class SyncService {
  private readonly db: Database.Database;
  private readonly memoService: MemoService;

  constructor(options: SyncServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('SyncService requires either db or config option');
    }
    this.memoService = new MemoService({ db: this.db, sourceType: options.sourceType });
  }

  public listChanges(since: number, limit: number): SyncChangesPage {
    return listSyncChanges(this.db, since, limit);
  }

  public applyPush(deviceId: string, operations: SyncPushOperation[]): SyncPushResult {
    const results = operations.map((op) => this.applyOne(deviceId, op));
    return { results, latestSeq: getLatestSeq(this.db) };
  }

  private applyOne(deviceId: string, op: SyncPushOperation): SyncPushOperationResult {
    const existing = getAppliedOp(this.db, op.opId);
    if (existing) {
      const stored = JSON.parse(existing.result) as SyncPushOperationResult;
      return {
        ...stored,
        status: stored.status === 'applied' ? 'alreadyApplied' : stored.status
      };
    }

    // Each operation applies in its own transaction so a conflict or skip in
    // one op never rolls back its predecessors (partial success by design).
    return this.db.transaction(() => {
      const result =
        op.entity === 'memo' ? this.applyMemoOp(deviceId, op) : this.applyCommentOp(op);
      recordAppliedOp(this.db, op.opId, deviceId, JSON.stringify(result));
      return result;
    })();
  }

  private applyMemoOp(deviceId: string, op: SyncPushOperation): SyncPushOperationResult {
    switch (op.type) {
      case 'create':
        return this.applyMemoCreate(op);
      case 'update':
        return this.applyMemoUpdate(deviceId, op);
      case 'delete':
        return this.applyMemoDelete(op);
    }
  }

  private applyMemoCreate(op: SyncPushOperation): SyncPushOperationResult {
    const existing = findIssueByUuid(this.db, op.uuid);
    if (existing) {
      return {
        opId: op.opId,
        status: 'alreadyApplied',
        uuid: op.uuid,
        serverId: existing.id,
        updatedAt: existing.updatedAt
      };
    }

    const memo = this.memoService.createFromSync({
      uuid: op.uuid,
      bodyMd: op.payload?.bodyMd ?? '',
      createdAt: op.payload?.createdAt,
      isBookmarked: op.payload?.isBookmarked
    });
    return {
      opId: op.opId,
      status: 'applied',
      uuid: op.uuid,
      serverId: memo.id,
      updatedAt: memo.updatedAt
    };
  }

  private applyMemoUpdate(deviceId: string, op: SyncPushOperation): SyncPushOperationResult {
    const row = findIssueByUuid(this.db, op.uuid);

    if (!row) {
      // The row never reached the server (pathological, since creates are
      // pushed first). Content preservation wins: materialize the edit as a
      // create when there is a body; otherwise there is nothing to apply.
      if (op.payload?.bodyMd !== undefined) {
        const memo = this.memoService.createFromSync({
          uuid: op.uuid,
          bodyMd: op.payload.bodyMd,
          createdAt: op.payload.createdAt,
          isBookmarked: op.payload.isBookmarked
        });
        return {
          opId: op.opId,
          status: 'applied',
          uuid: op.uuid,
          serverId: memo.id,
          updatedAt: memo.updatedAt
        };
      }
      return { opId: op.opId, status: 'skipped', uuid: op.uuid };
    }

    if (row.type !== 'memo') {
      return { opId: op.opId, status: 'skipped', uuid: op.uuid, serverId: row.id };
    }

    // Edit beats delete: an offline edit resurrects a server-side delete.
    if (row.isDeleted) {
      undeleteIssue(this.db, row.id);
      return this.applyMemoPayload(op, row.id);
    }

    const baseMatches = op.baseUpdatedAt != null && op.baseUpdatedAt === row.updatedAt;
    const bodyChanged =
      op.payload?.bodyMd !== undefined && op.payload.bodyMd !== row.bodyMd;

    if (!baseMatches && bodyChanged) {
      // Concurrent body edits: keep the server version, save the client
      // version as a conflicted copy so nothing is lost.
      const conflictCopyUuid = uuidv7();
      this.memoService.createFromSync({
        uuid: conflictCopyUuid,
        bodyMd: `> Conflicted copy (from device ${deviceId}, ${nowIso()})\n\n${op.payload!.bodyMd}`
      });
      if (op.payload?.isBookmarked !== undefined) {
        this.memoService.setBookmark(row.id, op.payload.isBookmarked);
      }
      const current = findIssueByUuid(this.db, op.uuid)!;
      return {
        opId: op.opId,
        status: 'conflictCopied',
        uuid: op.uuid,
        serverId: row.id,
        updatedAt: current.updatedAt,
        conflictCopyUuid
      };
    }

    // Base matches (clean fast-forward), or the divergence is content-free
    // (same body / bookmark-only diff): last-write-wins, client value applies.
    return this.applyMemoPayload(op, row.id);
  }

  private applyMemoPayload(op: SyncPushOperation, serverId: number): SyncPushOperationResult {
    if (op.payload?.bodyMd !== undefined) {
      this.memoService.edit({ id: serverId, bodyMd: op.payload.bodyMd });
    }
    if (op.payload?.isBookmarked !== undefined) {
      this.memoService.setBookmark(serverId, op.payload.isBookmarked);
    }
    const current = findIssueByUuid(this.db, op.uuid)!;
    return {
      opId: op.opId,
      status: 'applied',
      uuid: op.uuid,
      serverId,
      updatedAt: current.updatedAt
    };
  }

  private applyMemoDelete(op: SyncPushOperation): SyncPushOperationResult {
    const row = findIssueByUuid(this.db, op.uuid);
    if (!row || row.isDeleted) {
      return {
        opId: op.opId,
        status: 'alreadyApplied',
        uuid: op.uuid,
        ...(row ? { serverId: row.id, updatedAt: row.updatedAt } : {})
      };
    }

    // Edit beats delete: the server row changed since the client last saw it,
    // so the stale delete is dropped.
    if (op.baseUpdatedAt != null && op.baseUpdatedAt !== row.updatedAt) {
      return {
        opId: op.opId,
        status: 'skipped',
        uuid: op.uuid,
        serverId: row.id,
        updatedAt: row.updatedAt
      };
    }

    this.memoService.remove(row.id);
    const current = findIssueByUuid(this.db, op.uuid)!;
    return {
      opId: op.opId,
      status: 'applied',
      uuid: op.uuid,
      serverId: row.id,
      updatedAt: current.updatedAt
    };
  }

  private applyCommentOp(op: SyncPushOperation): SyncPushOperationResult {
    switch (op.type) {
      case 'create': {
        const existing = findCommentByUuid(this.db, op.uuid);
        if (existing) {
          return {
            opId: op.opId,
            status: 'alreadyApplied',
            uuid: op.uuid,
            serverId: existing.id,
            updatedAt: existing.updatedAt
          };
        }
        const parent = op.issueUuid ? findIssueByUuid(this.db, op.issueUuid) : null;
        if (!parent) {
          return { opId: op.opId, status: 'skipped', uuid: op.uuid };
        }
        const comment = this.memoService.addCommentFromSync(
          parent.id,
          op.payload?.bodyMd ?? '',
          { uuid: op.uuid, createdAt: op.payload?.createdAt }
        );
        return {
          opId: op.opId,
          status: 'applied',
          uuid: op.uuid,
          serverId: comment.id,
          updatedAt: comment.updatedAt
        };
      }
      case 'update': {
        const row = findCommentByUuid(this.db, op.uuid);
        if (!row) {
          return { opId: op.opId, status: 'skipped', uuid: op.uuid };
        }
        // Edit beats delete; beyond that comments are plain LWW (no
        // conflicted copies — short texts, low collision odds).
        if (row.isDeleted) {
          undeleteComment(this.db, row.id);
        }
        const updated =
          op.payload?.bodyMd !== undefined
            ? this.memoService.updateComment(row.id, op.payload.bodyMd)
            : findCommentByUuid(this.db, op.uuid)!;
        return {
          opId: op.opId,
          status: 'applied',
          uuid: op.uuid,
          serverId: row.id,
          updatedAt: updated.updatedAt
        };
      }
      case 'delete': {
        const row = findCommentByUuid(this.db, op.uuid);
        if (!row || row.isDeleted) {
          return {
            opId: op.opId,
            status: 'alreadyApplied',
            uuid: op.uuid,
            ...(row ? { serverId: row.id, updatedAt: row.updatedAt } : {})
          };
        }
        if (op.baseUpdatedAt != null && op.baseUpdatedAt !== row.updatedAt) {
          return {
            opId: op.opId,
            status: 'skipped',
            uuid: op.uuid,
            serverId: row.id,
            updatedAt: row.updatedAt
          };
        }
        this.memoService.deleteComment(row.id);
        const current = findCommentByUuid(this.db, op.uuid)!;
        return {
          opId: op.opId,
          status: 'applied',
          uuid: op.uuid,
          serverId: row.id,
          updatedAt: current.updatedAt
        };
      }
    }
  }
}
