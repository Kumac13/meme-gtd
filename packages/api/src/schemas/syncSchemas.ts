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
 * One client-side pending operation to apply on the server.
 */
export const SyncPushOperationSchema = z
  .object({
    opId: z.string().min(1).max(128).describe('Client-minted idempotency key (UUID). Replays return the recorded result.'),
    entity: z.enum(['memo', 'comment']).describe('Entity kind this operation targets'),
    type: z.enum(['create', 'update', 'delete']).describe('Operation type'),
    uuid: z.string().min(1).max(128).describe('Sync identity of the target row (client-minted UUIDv7 for offline-created rows)'),
    issueUuid: z.string().min(1).max(128).optional().describe('Parent issue uuid (required for comment create)'),
    baseUpdatedAt: z
      .string()
      .nullable()
      .optional()
      .describe('The server updatedAt this edit was based on. Compared for equality only; mismatch triggers conflict handling.'),
    payload: z
      .object({
        bodyMd: z.string().optional().describe('Body content (required for create)'),
        isBookmarked: z.boolean().optional().describe('Bookmark state'),
        createdAt: z.string().optional().describe('Offline authoring time to preserve (create only)'),
        updatedAt: z.string().optional().describe('Client-side update time (informational)'),
      })
      .optional()
      .describe('Operation payload; omitted for delete'),
  })
  .superRefine((op, ctx) => {
    if (op.type === 'create' && (op.payload?.bodyMd === undefined || op.payload.bodyMd.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payload', 'bodyMd'],
        message: 'payload.bodyMd is required for create operations',
      });
    }
    if (op.type === 'create' && op.entity === 'comment' && !op.issueUuid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['issueUuid'],
        message: 'issueUuid is required for comment create operations',
      });
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
