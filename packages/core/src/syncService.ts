import Database from 'better-sqlite3';
import { ensureDatabase } from 'meme-gtd-db';
import type { MgtdConfig } from 'meme-gtd-config';
import { nowIso, uuidv7, type SourceType, type TaskStatus, type TaskKind } from 'meme-gtd-shared';
import {
  findCommentByUuid,
  findIssueByUuid,
  findLink,
  getAppliedOp,
  getLabelByName,
  getLatestSeq,
  hasIssueLabel,
  listSyncChanges,
  recordAppliedOp,
  undeleteComment,
  undeleteIssue,
  type SyncChangesPage,
  type SyncIssueRecord
} from 'meme-gtd-db';
import { ArticleService, LabelService, MemoService, TaskService } from './index.js';
import { LinkService } from './linkService.js';

export interface SyncServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
  sourceType?: SourceType;
}

export type SyncPushEntity =
  | 'memo'
  | 'comment'
  | 'task'
  | 'article'
  | 'label'
  | 'issue_label'
  | 'link';

export type SyncPushLinkType = 'parent' | 'child' | 'relates' | 'derived_from';

export interface SyncPushOperation {
  opId: string;
  entity: SyncPushEntity;
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
    // task / article
    title?: string;
    // task
    status?: TaskStatus;
    taskKind?: TaskKind;
    scheduledStart?: string;
    scheduledEnd?: string;
    isAllDay?: boolean;
    scheduledOn?: string;
    actualStart?: string;
    actualEnd?: string;
    // article
    meta?: {
      originalUrl?: string;
      siteName?: string;
      archivedAt?: string;
    };
    // label
    name?: string;
    description?: string;
    // issue_label
    issueUuid?: string;
    labelName?: string;
    // link
    sourceIssueUuid?: string;
    targetIssueUuid?: string;
    linkType?: SyncPushLinkType;
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
  /** Human-readable explanation, set when status is 'skipped' for bulk-migration entities. */
  reason?: string;
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
 * Bulk-migration entities (iOS Standalone -> Server one-way migration):
 * - task / article / label / issue_label / link accept CREATE operations only.
 * - Idempotency beyond the opId ledger: task/article replay on uuid, label on
 *   its natural key (name), issue_label / link on the existing pair — all
 *   reported as alreadyApplied so re-runs are safe.
 * - Reference resolution (issue_label / link / comment) happens per operation;
 *   the client guarantees dependency order (labels -> issues -> issue_labels ->
 *   comments -> links) within its FIFO stream. Unresolvable references are
 *   'skipped' with a reason.
 *
 * All mutations go through the domain services (MemoService / TaskService /
 * ArticleService / LabelService / LinkService) so the activity log stays
 * complete.
 */
export class SyncService {
  private readonly db: Database.Database;
  private readonly memoService: MemoService;
  private readonly taskService: TaskService;
  private readonly articleService: ArticleService;
  private readonly labelService: LabelService;
  private readonly linkService: LinkService;

  constructor(options: SyncServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('SyncService requires either db or config option');
    }
    this.memoService = new MemoService({ db: this.db, sourceType: options.sourceType });
    this.taskService = new TaskService({ db: this.db, sourceType: options.sourceType });
    this.articleService = new ArticleService({ db: this.db, sourceType: options.sourceType });
    this.labelService = new LabelService({ db: this.db, sourceType: options.sourceType });
    this.linkService = new LinkService({ db: this.db, sourceType: options.sourceType });
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
      const result = this.applyEntityOp(deviceId, op);
      recordAppliedOp(this.db, op.opId, deviceId, JSON.stringify(result));
      return result;
    })();
  }

  private applyEntityOp(deviceId: string, op: SyncPushOperation): SyncPushOperationResult {
    switch (op.entity) {
      case 'memo':
        return this.applyMemoOp(deviceId, op);
      case 'comment':
        return this.applyCommentOp(op);
      case 'task':
        return this.applyCreateOnly(op, () => this.applyTaskCreate(op));
      case 'article':
        return this.applyCreateOnly(op, () => this.applyArticleCreate(op));
      case 'label':
        return this.applyCreateOnly(op, () => this.applyLabelCreate(op));
      case 'issue_label':
        return this.applyCreateOnly(op, () => this.applyIssueLabelCreate(op));
      case 'link':
        return this.applyCreateOnly(op, () => this.applyLinkCreate(op));
    }
  }

  /**
   * Bulk-migration entities accept create only. The API schema rejects
   * update/delete with a 400 before reaching here; this guard covers direct
   * core callers.
   */
  private applyCreateOnly(
    op: SyncPushOperation,
    create: () => SyncPushOperationResult
  ): SyncPushOperationResult {
    if (op.type !== 'create') {
      return {
        opId: op.opId,
        status: 'skipped',
        uuid: op.uuid,
        reason: `entity '${op.entity}' only supports create operations`
      };
    }
    return create();
  }

  private applyTaskCreate(op: SyncPushOperation): SyncPushOperationResult {
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
    if (!op.payload?.title) {
      return {
        opId: op.opId,
        status: 'skipped',
        uuid: op.uuid,
        reason: 'payload.title is required for task create'
      };
    }

    const task = this.taskService.createFromSync({
      uuid: op.uuid,
      title: op.payload.title,
      bodyMd: op.payload.bodyMd,
      status: op.payload.status,
      taskKind: op.payload.taskKind,
      scheduledStart: op.payload.scheduledStart,
      scheduledEnd: op.payload.scheduledEnd,
      isAllDay: op.payload.isAllDay,
      scheduledOn: op.payload.scheduledOn,
      actualStart: op.payload.actualStart,
      actualEnd: op.payload.actualEnd,
      createdAt: op.payload.createdAt,
      updatedAt: op.payload.updatedAt
    });
    return {
      opId: op.opId,
      status: 'applied',
      uuid: op.uuid,
      serverId: task.id,
      updatedAt: task.updatedAt
    };
  }

  private applyArticleCreate(op: SyncPushOperation): SyncPushOperationResult {
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
    if (!op.payload?.title || op.payload.bodyMd === undefined || !op.payload.meta?.originalUrl) {
      return {
        opId: op.opId,
        status: 'skipped',
        uuid: op.uuid,
        reason: 'payload.title, payload.bodyMd and payload.meta.originalUrl are required for article create'
      };
    }

    const article = this.articleService.createFromSync({
      uuid: op.uuid,
      title: op.payload.title,
      bodyMd: op.payload.bodyMd,
      originalUrl: op.payload.meta.originalUrl,
      siteName: op.payload.meta.siteName,
      archivedAt: op.payload.meta.archivedAt,
      createdAt: op.payload.createdAt
    });
    return {
      opId: op.opId,
      status: 'applied',
      uuid: op.uuid,
      serverId: article.id,
      updatedAt: article.updatedAt
    };
  }

  private applyLabelCreate(op: SyncPushOperation): SyncPushOperationResult {
    if (!op.payload?.name) {
      return {
        opId: op.opId,
        status: 'skipped',
        uuid: op.uuid,
        reason: 'payload.name is required for label create'
      };
    }

    // Labels have no uuid column — name is the natural key. An existing label
    // with the same name means the create already happened (idempotent re-run,
    // not an error).
    const existing = getLabelByName(this.db, op.payload.name);
    if (existing) {
      return {
        opId: op.opId,
        status: 'alreadyApplied',
        uuid: op.uuid,
        serverId: existing.id
      };
    }

    const label = this.labelService.createFromSync({
      name: op.payload.name,
      description: op.payload.description,
      createdAt: op.payload.createdAt
    });
    return {
      opId: op.opId,
      status: 'applied',
      uuid: op.uuid,
      serverId: label.id
    };
  }

  private applyIssueLabelCreate(op: SyncPushOperation): SyncPushOperationResult {
    if (!op.payload?.issueUuid || !op.payload.labelName) {
      return {
        opId: op.opId,
        status: 'skipped',
        uuid: op.uuid,
        reason: 'payload.issueUuid and payload.labelName are required for issue_label create'
      };
    }

    const issue = this.resolveIssue(op.payload.issueUuid);
    if (!issue) {
      return {
        opId: op.opId,
        status: 'skipped',
        uuid: op.uuid,
        reason: `issue not found for uuid ${op.payload.issueUuid}`
      };
    }
    const label = getLabelByName(this.db, op.payload.labelName);
    if (!label) {
      return {
        opId: op.opId,
        status: 'skipped',
        uuid: op.uuid,
        reason: `label not found for name ${op.payload.labelName}`
      };
    }

    if (hasIssueLabel(this.db, issue.id, label.id)) {
      return {
        opId: op.opId,
        status: 'alreadyApplied',
        uuid: op.uuid,
        serverId: label.id
      };
    }

    this.labelService.assignToIssue(issue.id, label.id);
    return {
      opId: op.opId,
      status: 'applied',
      uuid: op.uuid,
      serverId: label.id
    };
  }

  private applyLinkCreate(op: SyncPushOperation): SyncPushOperationResult {
    if (!op.payload?.sourceIssueUuid || !op.payload.targetIssueUuid || !op.payload.linkType) {
      return {
        opId: op.opId,
        status: 'skipped',
        uuid: op.uuid,
        reason:
          'payload.sourceIssueUuid, payload.targetIssueUuid and payload.linkType are required for link create'
      };
    }

    const source = this.resolveIssue(op.payload.sourceIssueUuid);
    if (!source) {
      return {
        opId: op.opId,
        status: 'skipped',
        uuid: op.uuid,
        reason: `source issue not found for uuid ${op.payload.sourceIssueUuid}`
      };
    }
    const target = this.resolveIssue(op.payload.targetIssueUuid);
    if (!target) {
      return {
        opId: op.opId,
        status: 'skipped',
        uuid: op.uuid,
        reason: `target issue not found for uuid ${op.payload.targetIssueUuid}`
      };
    }

    const existing = findLink(this.db, {
      sourceIssueId: source.id,
      targetIssueId: target.id,
      linkType: op.payload.linkType
    });
    if (existing) {
      return {
        opId: op.opId,
        status: 'alreadyApplied',
        uuid: op.uuid,
        serverId: existing.id
      };
    }
    // 'relates' is symmetric: an existing inverse row is the same relationship.
    if (op.payload.linkType === 'relates') {
      const inverse = findLink(this.db, {
        sourceIssueId: target.id,
        targetIssueId: source.id,
        linkType: 'relates'
      });
      if (inverse) {
        return {
          opId: op.opId,
          status: 'alreadyApplied',
          uuid: op.uuid,
          serverId: inverse.id
        };
      }
    }

    try {
      const link = this.linkService.create(source.id, target.id, op.payload.linkType);
      return {
        opId: op.opId,
        status: 'applied',
        uuid: op.uuid,
        serverId: link.id
      };
    } catch (e) {
      // Domain validation failures (self link, inverse parent-child, circular
      // hierarchy) drop the op instead of failing the whole batch.
      return {
        opId: op.opId,
        status: 'skipped',
        uuid: op.uuid,
        reason: e instanceof Error ? e.message : 'link validation failed'
      };
    }
  }

  /** Resolve an issue reference by uuid; soft-deleted rows do not qualify. */
  private resolveIssue(uuid: string): SyncIssueRecord | null {
    const issue = findIssueByUuid(this.db, uuid);
    if (!issue || issue.isDeleted) {
      return null;
    }
    return issue;
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
