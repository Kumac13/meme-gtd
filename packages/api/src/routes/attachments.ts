/**
 * Attachment routes for image upload and retrieval
 */

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  IssueIdParamsSchema,
  AttachmentParamsSchema,
  AttachmentResponseSchema,
  AttachmentErrorSchema,
} from '../schemas/attachmentSchemas.js';
import {
  uploadAttachment,
  getAttachment,
} from '../handlers/attachmentHandlers.js';

/**
 * Register attachment routes
 */
export async function attachmentRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/attachments/:issueId - Upload an image
  typedApp.post('/api/attachments/:issueId', {
    schema: {
      description: 'Upload an image attachment for an issue',
      tags: ['Attachments'],
      params: IssueIdParamsSchema,
      consumes: ['multipart/form-data'],
      response: {
        201: AttachmentResponseSchema,
        400: AttachmentErrorSchema,
        404: AttachmentErrorSchema,
        500: AttachmentErrorSchema,
      },
    },
    handler: uploadAttachment,
  });

  // GET /api/attachments/:issueId/:filename - Get an image
  typedApp.get('/api/attachments/:issueId/:filename', {
    schema: {
      description: 'Get an attachment image file',
      tags: ['Attachments'],
      params: AttachmentParamsSchema,
      response: {
        404: AttachmentErrorSchema,
        500: AttachmentErrorSchema,
      },
    },
    handler: getAttachment,
  });
}
