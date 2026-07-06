import type { FastifyRequest, FastifyReply } from 'fastify';
import { SyncService } from 'meme-gtd-core';
import type { SyncChangesQuery, SyncPushRequest } from '../schemas/syncSchemas.js';

const DEFAULT_CHANGES_LIMIT = 500;

/**
 * Return the change feed after the given cursor (delta pull for offline clients).
 */
export async function getSyncChangesHandler(
  request: FastifyRequest<{ Querystring: SyncChangesQuery }>,
  reply: FastifyReply
) {
  const { since, limit } = request.query;
  const syncService = new SyncService({ db: request.server.db });
  const page = syncService.listChanges(since, limit ?? DEFAULT_CHANGES_LIMIT);
  return reply.send(page);
}

/**
 * Apply a batch of client operations (offline outbox push).
 */
export async function postSyncPushHandler(
  request: FastifyRequest<{ Body: SyncPushRequest }>,
  reply: FastifyReply
) {
  const { deviceId, operations } = request.body;
  const syncService = new SyncService({ db: request.server.db });
  const result = syncService.applyPush(deviceId, operations);
  return reply.send(result);
}
