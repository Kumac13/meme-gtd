import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createUrlLinkHandler,
  listUrlLinksHandler,
  deleteUrlLinkHandler,
} from '../handlers/urlLinkHandlers.js';
import {
  CreateUrlLinkRequestSchema,
  UrlLinkSchema,
  UrlLinkIdParamsSchema,
  IssueIdForUrlLinksParamsSchema,
} from '../schemas/urlLinkSchemas.js';
import { ErrorResponseSchema } from '../schemas/errorSchemas.js';

/**
 * Register URL link routes
 * @param app Fastify instance
 */
export async function urlLinkRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/issues/:id/url-links - Create a new URL link
  server.post(
    '/api/issues/:id/url-links',
    {
      schema: {
        tags: ['URL Links'],
        summary: 'Create URL link',
        description: 'Create an external URL link for an issue',
        operationId: 'createUrlLink',
        params: IssueIdForUrlLinksParamsSchema,
        body: CreateUrlLinkRequestSchema,
        response: {
          201: UrlLinkSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    createUrlLinkHandler
  );

  // GET /api/issues/:id/url-links - List all URL links for an issue
  server.get(
    '/api/issues/:id/url-links',
    {
      schema: {
        tags: ['URL Links'],
        summary: 'List URL links',
        description: 'List all external URL links for a given issue',
        operationId: 'listUrlLinks',
        params: IssueIdForUrlLinksParamsSchema,
        response: {
          200: z.array(UrlLinkSchema),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    listUrlLinksHandler
  );

  // DELETE /api/url-links/:id - Delete a URL link
  server.delete(
    '/api/url-links/:id',
    {
      schema: {
        tags: ['URL Links'],
        summary: 'Delete URL link',
        description: 'Delete a URL link by ID',
        operationId: 'deleteUrlLink',
        params: UrlLinkIdParamsSchema,
        response: {
          204: z.void(),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    deleteUrlLinkHandler
  );
}
