import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  listLabelsHandler,
  createLabelHandler,
  assignLabelHandler,
  deleteLabelHandler,
} from '../handlers/labelHandlers.js';
import {
  CreateLabelRequestSchema,
  AssignLabelRequestSchema,
  LabelSchema,
  LabelNameParamsSchema,
  IssueIdParamsSchema,
} from '../schemas/labelSchemas.js';
import { ErrorResponseSchema } from '../schemas/errorSchemas.js';

/**
 * Register label routes
 * @param app Fastify instance
 */
export async function labelRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // GET /api/labels - List all labels
  server.get(
    '/api/labels',
    {
      schema: {
        tags: ['Labels'],
        description: 'List all labels',
        response: {
          200: z.array(LabelSchema),
          500: ErrorResponseSchema,
        },
      },
    },
    listLabelsHandler
  );

  // POST /api/labels - Create a new label
  server.post(
    '/api/labels',
    {
      schema: {
        tags: ['Labels'],
        description: 'Create a new label',
        body: CreateLabelRequestSchema,
        response: {
          201: LabelSchema,
          400: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    createLabelHandler
  );

  // POST /api/issues/:issueId/labels - Assign label to issue
  server.post(
    '/api/issues/:issueId/labels',
    {
      schema: {
        tags: ['Labels'],
        description: 'Assign a label to an issue (idempotent)',
        params: IssueIdParamsSchema,
        body: AssignLabelRequestSchema,
        response: {
          200: z.object({ success: z.boolean() }),
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    assignLabelHandler
  );

  // DELETE /api/labels/:name - Delete a label
  server.delete(
    '/api/labels/:name',
    {
      schema: {
        tags: ['Labels'],
        description: 'Delete a label by name',
        params: LabelNameParamsSchema,
        response: {
          204: z.void(),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    deleteLabelHandler
  );
}
