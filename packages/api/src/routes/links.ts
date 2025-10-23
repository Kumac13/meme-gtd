import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createLinkHandler,
  listLinksHandler,
  deleteLinkHandler,
} from '../handlers/linkHandlers.js';
import {
  CreateLinkRequestSchema,
  LinkSchema,
  LinkWithDirectionSchema,
  LinkIdParamsSchema,
  IssueIdForLinksParamsSchema,
  ListLinksQuerySchema,
} from '../schemas/linkSchemas.js';
import { ErrorResponseSchema } from '../schemas/errorSchemas.js';

/**
 * Register link routes
 * @param app Fastify instance
 */
export async function linkRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/links - Create a new link
  server.post(
    '/api/links',
    {
      schema: {
        tags: ['Links'],
        summary: 'Create link',
        description: 'Create a link between two issues',
        operationId: 'createLink',
        body: CreateLinkRequestSchema,
        response: {
          201: LinkSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    createLinkHandler
  );

  // GET /api/issues/:id/links - List all links for an issue
  server.get(
    '/api/issues/:id/links',
    {
      schema: {
        tags: ['Links'],
        summary: 'List issue links',
        description: 'List all links for a given issue with direction. Optionally filter by link type using ?type= query parameter.',
        operationId: 'listIssueLinks',
        params: IssueIdForLinksParamsSchema,
        querystring: ListLinksQuerySchema,
        response: {
          200: z.array(LinkWithDirectionSchema),
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    listLinksHandler
  );

  // DELETE /api/links/:id - Delete a link
  server.delete(
    '/api/links/:id',
    {
      schema: {
        tags: ['Links'],
        summary: 'Delete link',
        description: 'Delete a link by ID',
        operationId: 'deleteLink',
        params: LinkIdParamsSchema,
        response: {
          204: z.void(),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    deleteLinkHandler
  );
}
