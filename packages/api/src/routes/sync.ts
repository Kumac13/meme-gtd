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
          'Apply a batch of offline operations (memo/comment create/update/delete) in order. Each operation is idempotent via opId and applies in its own transaction (partial success). Conflict rules: last-write-wins per record; concurrent memo body edits keep the server version and save the client body as a conflicted-copy memo; edits beat deletes in both directions.',
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
