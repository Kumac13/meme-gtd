import { z } from 'zod';

/**
 * Query schema for GET /api/sync/changes — pull the change feed after a cursor.
 */
export const SyncChangesQuerySchema = z.object({
  since: z.coerce
    .number()
    .int()
    .min(0)
    .describe('Pull cursor: return changes with serverSeq greater than this value. Use 0 for the initial full pull.'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum number of changes to return (default: 500, max: 1000)'),
});

export type SyncChangesQuery = z.infer<typeof SyncChangesQuerySchema>;

/**
 * A single entry in the change feed.
 *
 * data shape by entity (op:'upsert'):
 * - issue: full issue row (id, uuid, type, title, bodyMd, status, taskKind,
 *   scheduling fields, meta, isBookmarked, isDeleted, createdAt, updatedAt).
 *   Soft-deleted rows are included (isDeleted=true acts as the tombstone).
 * - comment: { id, uuid, issueId, issueUuid, bodyMd, createdAt, updatedAt, isDeleted }
 * - label: { id, name, description, createdAt }
 * - issue_label: { issueId, labelId, issueUuid, labelName, assignedAt }
 *
 * op:'delete' (labels / issue_labels are hard-deleted, so deletions arrive as
 * tombstones): data carries the integer ids plus labelName / issueUuid when
 * they were resolvable at delete time, and deletedAt.
 */
export const SyncChangeSchema = z.object({
  serverSeq: z.number().int().positive().describe('Global monotonic sequence number of this change'),
  entity: z.enum(['issue', 'comment', 'label', 'issue_label']).describe('Entity kind this change applies to'),
  op: z.enum(['upsert', 'delete']).describe('upsert: apply the row in data; delete: remove the entity identified by data'),
  data: z.record(z.any()).describe('Entity payload; shape depends on entity and op (see endpoint description)'),
});

export type SyncChange = z.infer<typeof SyncChangeSchema>;

/**
 * Response schema for GET /api/sync/changes.
 */
export const SyncChangesResponseSchema = z.object({
  changes: z.array(SyncChangeSchema).describe('Changes ordered by serverSeq ascending'),
  latestSeq: z.number().int().nonnegative().describe('Highest serverSeq on the server right now'),
  hasMore: z.boolean().describe('True when more changes exist beyond this page; pull again with since = last serverSeq'),
});

export type SyncChangesResponse = z.infer<typeof SyncChangesResponseSchema>;

/**
 * Entities that only accept create operations through push (iOS Standalone ->
 * Server one-way bulk migration).
 */
const CREATE_ONLY_ENTITIES = ['task', 'article', 'label', 'issue_label', 'link'] as const;

/**
 * One client-side pending operation to apply on the server.
 */
export const SyncPushOperationSchema = z
  .object({
    opId: z.string().min(1).max(128).describe('Client-minted idempotency key (UUID). Replays return the recorded result.'),
    entity: z
      .enum(['memo', 'comment', 'task', 'article', 'label', 'issue_label', 'link'])
      .describe(
        'Entity kind this operation targets. memo/comment support create/update/delete; task/article/label/issue_label/link support create only (bulk migration).'
      ),
    type: z.enum(['create', 'update', 'delete']).describe('Operation type'),
    uuid: z.string().min(1).max(128).describe('Sync identity of the target row (client-minted UUIDv7 for offline-created rows). Echoed back for entities without a server uuid column (label / issue_label / link).'),
    issueUuid: z.string().min(1).max(128).optional().describe('Parent issue uuid (required for comment create)'),
    baseUpdatedAt: z
      .string()
      .nullable()
      .optional()
      .describe('The server updatedAt this edit was based on. Compared for equality only; mismatch triggers conflict handling.'),
    payload: z
      .object({
        bodyMd: z.string().optional().describe('Body content (required for memo/comment/article create; optional for task)'),
        isBookmarked: z.boolean().optional().describe('Bookmark state (memo only)'),
        createdAt: z.string().optional().describe('Offline authoring time to preserve (create only)'),
        updatedAt: z.string().optional().describe('Client-side update time (stored as-is for task create; informational otherwise)'),
        title: z.string().min(1).optional().describe('Title (required for task/article create)'),
        status: z
          .enum(['inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'])
          .optional()
          .describe('Task status (task create only; default inbox)'),
        taskKind: z.enum(['event', 'action']).optional().describe('Task kind (task create only; default action)'),
        scheduledStart: z.string().optional().describe('Scheduled start, ISO 8601 datetime (task create only)'),
        scheduledEnd: z.string().optional().describe('Scheduled end, ISO 8601 datetime (task create only)'),
        isAllDay: z.boolean().optional().describe('All-day flag (task create only)'),
        scheduledOn: z.string().optional().describe('Deprecated scheduled date YYYY-MM-DD (task create only, backward compatibility)'),
        actualStart: z.string().optional().describe('Execution start stamp to preserve, ISO 8601 datetime (task create only)'),
        actualEnd: z.string().optional().describe('Execution end stamp to preserve, ISO 8601 datetime (task create only)'),
        meta: z
          .object({
            originalUrl: z.string().min(1).optional().describe('Source URL (required for article create)'),
            siteName: z.string().optional().describe('Site name'),
            archivedAt: z.string().optional().describe('Client-side archive time to preserve'),
          })
          .optional()
          .describe('Article metadata (article create only)'),
        name: z.string().min(1).optional().describe('Label name — the natural key (required for label create)'),
        description: z.string().optional().describe('Label description (label create only)'),
        issueUuid: z.string().min(1).max(128).optional().describe('Target issue uuid (required for issue_label create)'),
        labelName: z.string().min(1).optional().describe('Label name to attach (required for issue_label create)'),
        sourceIssueUuid: z.string().min(1).max(128).optional().describe('Link source issue uuid (required for link create)'),
        targetIssueUuid: z.string().min(1).max(128).optional().describe('Link target issue uuid (required for link create)'),
        linkType: z
          .enum(['parent', 'child', 'relates', 'derived_from'])
          .optional()
          .describe('Link type (required for link create)'),
      })
      .optional()
      .describe('Operation payload; omitted for delete. Which fields apply depends on entity.'),
  })
  .superRefine((op, ctx) => {
    if ((CREATE_ONLY_ENTITIES as readonly string[]).includes(op.entity) && op.type !== 'create') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: `entity '${op.entity}' only supports create operations`,
      });
      return;
    }
    if (op.type !== 'create') {
      return;
    }
    const requireField = (condition: boolean, path: (string | number)[], message: string) => {
      if (!condition) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
      }
    };
    switch (op.entity) {
      case 'memo':
      case 'comment':
        if (op.payload?.bodyMd === undefined || op.payload.bodyMd.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['payload', 'bodyMd'],
            message: 'payload.bodyMd is required for create operations',
          });
        }
        if (op.entity === 'comment' && !op.issueUuid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['issueUuid'],
            message: 'issueUuid is required for comment create operations',
          });
        }
        break;
      case 'task':
        requireField(!!op.payload?.title, ['payload', 'title'], 'payload.title is required for task create operations');
        break;
      case 'article':
        requireField(!!op.payload?.title, ['payload', 'title'], 'payload.title is required for article create operations');
        requireField(
          op.payload?.bodyMd !== undefined,
          ['payload', 'bodyMd'],
          'payload.bodyMd is required for article create operations'
        );
        requireField(
          !!op.payload?.meta?.originalUrl,
          ['payload', 'meta', 'originalUrl'],
          'payload.meta.originalUrl is required for article create operations'
        );
        break;
      case 'label':
        requireField(!!op.payload?.name, ['payload', 'name'], 'payload.name is required for label create operations');
        break;
      case 'issue_label':
        requireField(
          !!op.payload?.issueUuid,
          ['payload', 'issueUuid'],
          'payload.issueUuid is required for issue_label create operations'
        );
        requireField(
          !!op.payload?.labelName,
          ['payload', 'labelName'],
          'payload.labelName is required for issue_label create operations'
        );
        break;
      case 'link':
        requireField(
          !!op.payload?.sourceIssueUuid,
          ['payload', 'sourceIssueUuid'],
          'payload.sourceIssueUuid is required for link create operations'
        );
        requireField(
          !!op.payload?.targetIssueUuid,
          ['payload', 'targetIssueUuid'],
          'payload.targetIssueUuid is required for link create operations'
        );
        requireField(
          !!op.payload?.linkType,
          ['payload', 'linkType'],
          'payload.linkType is required for link create operations'
        );
        break;
    }
  });

export type SyncPushOperation = z.infer<typeof SyncPushOperationSchema>;

/**
 * Request schema for POST /api/sync/push.
 */
export const SyncPushRequestSchema = z.object({
  deviceId: z.string().min(1).max(128).describe('Stable identifier of the pushing device (used in conflicted-copy annotations)'),
  operations: z
    .array(SyncPushOperationSchema)
    .min(1)
    .max(500)
    .describe('Operations in client FIFO order (parents before children)'),
});

export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

/**
 * Per-operation result of a push.
 */
export const SyncPushOperationResultSchema = z.object({
  opId: z.string().describe('Echo of the operation opId'),
  status: z
    .enum(['applied', 'alreadyApplied', 'conflictCopied', 'skipped'])
    .describe(
      'applied: change accepted; alreadyApplied: idempotent replay or existing state; conflictCopied: server version kept, client body saved as a conflicted-copy memo; skipped: dropped (e.g. stale delete lost to edit-beats-delete)'
    ),
  uuid: z.string().describe('Sync identity of the target row'),
  serverId: z.number().int().positive().optional().describe('Server-assigned integer id of the row'),
  updatedAt: z.string().optional().describe('Server updatedAt after applying — store as the new base for future edits'),
  conflictCopyUuid: z.string().optional().describe('uuid of the conflicted-copy memo (status conflictCopied only)'),
  reason: z
    .string()
    .optional()
    .describe('Human-readable explanation for skipped bulk-migration operations (e.g. unresolved issue/label reference)'),
});

export type SyncPushOperationResult = z.infer<typeof SyncPushOperationResultSchema>;

/**
 * Response schema for POST /api/sync/push.
 */
export const SyncPushResponseSchema = z.object({
  results: z.array(SyncPushOperationResultSchema).describe('One result per operation, same order as the request'),
  latestSeq: z.number().int().nonnegative().describe('Highest serverSeq after applying — pull from your last cursor to converge'),
});

export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>;
