import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getSyncChangesHandler, postSyncPushHandler } from '../handlers/syncHandlers.js';
import {
  SyncChangesQuerySchema,
  SyncChangesResponseSchema,
  SyncPushRequestSchema,
  SyncPushResponseSchema,
} from '../schemas/syncSchemas.js';
import { ErrorResponseSchema } from '../schemas/errorSchemas.js';

/**
 * Register sync routes (iOS offline sync: delta pull + outbox push)
 * @param app Fastify instance
 */
export async function syncRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // GET /api/sync/changes - Delta pull
  server.get(
    '/api/sync/changes',
    {
      schema: {
        tags: ['Sync'],
        summary: 'List changes after a cursor',
        description:
          'Return all changes (issues, comments, labels, issue_labels) with serverSeq greater than the cursor, ordered by serverSeq ascending. Soft-deleted issues/comments are included as upserts with isDeleted=true; hard-deleted labels/issue_labels arrive as op:delete tombstones. Pull with since=0 to bootstrap, then repeat with since=<last serverSeq> while hasMore is true.',
        operationId: 'listSyncChanges',
        querystring: SyncChangesQuerySchema,
        response: {
          200: SyncChangesResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    getSyncChangesHandler
  );

  // POST /api/sync/push - Outbox push
  server.post(
    '/api/sync/push',
    {
      schema: {
        tags: ['Sync'],
        summary: 'Apply client operations',
        description:
          'Apply a batch of offline operations in order. Memo and comment support create, update, and delete. ' +
          'Task supports create and status-only update. Task creation applies labels, projects, issue links, and URL links in the same transaction. ' +
          'Article, label, issue_label, and link support create. For bulk migration, send labels, issues, issue_labels and comments, then links. ' +
          'Each operation is idempotent via opId and applies in its own transaction (partial success). ' +
          'Replays are also detected without the opId ledger for task and article creates by UUID, labels by name, and issue_label and link by the existing pair. ' +
          'Operations with unresolvable references are skipped with a reason. ' +
          'Memo and comment use last-write-wins per record and edits beat deletes in both directions. ' +
          'Concurrent memo body edits keep the server version and save the client body as a conflicted copy.',
        operationId: 'pushSyncOperations',
        body: SyncPushRequestSchema,
        response: {
          200: SyncPushResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    postSyncPushHandler
  );
}
