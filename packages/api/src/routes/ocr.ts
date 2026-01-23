/**
 * OCR routes for text extraction from images
 */

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { OcrResponseSchema, OcrErrorResponseSchema } from '../schemas/ocrSchemas.js';
import { processOcr } from '../handlers/ocrHandlers.js';

/**
 * Register OCR routes
 */
export async function ocrRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/ocr - Extract text from an image
  typedApp.post('/api/ocr', {
    schema: {
      operationId: 'processOcr',
      summary: 'Extract text from an image using OCR',
      description: 'Upload an image (PNG, JPEG, GIF, WebP) and extract text using OCR. Supports Japanese vertical and horizontal text.',
      tags: ['OCR'],
      consumes: ['multipart/form-data'],
      response: {
        200: OcrResponseSchema,
        400: OcrErrorResponseSchema,
        500: OcrErrorResponseSchema,
      },
    },
    handler: processOcr,
  });
}
