/**
 * Attachment routes for image upload and retrieval
 */

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  FilenameParamsSchema,
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

  // POST /api/attachments - Upload an image
  typedApp.post('/api/attachments', {
    schema: {
      description: 'Upload an image attachment',
      tags: ['Attachments'],
      consumes: ['multipart/form-data'],
      response: {
        201: AttachmentResponseSchema,
        400: AttachmentErrorSchema,
        500: AttachmentErrorSchema,
      },
    },
    handler: uploadAttachment,
  });

  // GET /api/attachments/:filename - Get an image
  typedApp.get('/api/attachments/:filename', {
    schema: {
      description: 'Get an attachment image file',
      tags: ['Attachments'],
      params: FilenameParamsSchema,
      response: {
        404: AttachmentErrorSchema,
        500: AttachmentErrorSchema,
      },
    },
    handler: getAttachment,
  });
}
