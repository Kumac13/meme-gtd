import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  listLabelsHandler,
  createLabelHandler,
  assignLabelHandler,
  removeLabelFromIssueHandler,
  deleteLabelHandler,
} from '../handlers/labelHandlers.js';
import {
  CreateLabelRequestSchema,
  AssignLabelRequestSchema,
  LabelSchema,
  LabelNameParamsSchema,
  IssueIdParamsSchema,
  RemoveLabelParamsSchema,
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
        summary: 'List labels',
        description: 'List all labels',
        operationId: 'listLabels',
        response: {
          200: z.array(LabelSchema),
          400: ErrorResponseSchema,
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
        summary: 'Create label',
        description: 'Create a new label',
        operationId: 'createLabel',
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
        summary: 'Assign label to issue',
        description: 'Assign a label to an issue (idempotent)',
        operationId: 'assignLabelToIssue',
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

  // DELETE /api/issues/:issueId/labels/:labelId - Remove label from issue
  server.delete(
    '/api/issues/:issueId/labels/:labelId',
    {
      schema: {
        tags: ['Labels'],
        summary: 'Remove label from issue',
        description: 'Remove a label assignment from an issue (idempotent)',
        operationId: 'removeLabelFromIssue',
        params: RemoveLabelParamsSchema,
        response: {
          204: z.void(),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    removeLabelFromIssueHandler
  );

  // DELETE /api/labels/:name - Delete a label
  server.delete(
    '/api/labels/:name',
    {
      schema: {
        tags: ['Labels'],
        summary: 'Delete label',
        description: 'Delete a label by name',
        operationId: 'deleteLabel',
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
