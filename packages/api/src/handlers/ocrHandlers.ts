/**
 * Handlers for OCR (Optical Character Recognition) operations
 */

import { Buffer } from 'node:buffer';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import type { OcrResponse, OcrErrorResponse } from '../schemas/ocrSchemas.js';
import { performOcr } from '../services/ocrService.js';
import { isAllowedMimeType } from '../schemas/attachmentSchemas.js';

/**
 * Create an OCR error response
 */
function createOcrErrorResponse(
  error: string,
  code: OcrErrorResponse['code'],
  message: string
): OcrErrorResponse {
  return { error, code, message };
}

/**
 * Maximum file size for OCR (10MB)
 */
const MAX_OCR_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Process an image and extract text using OCR
 * POST /api/ocr
 */
export async function processOcr(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<OcrResponse | OcrErrorResponse> {
  // Get the uploaded file
  let file: MultipartFile | undefined;
  try {
    file = await request.file();
  } catch (error) {
    request.log.error({ error }, 'Failed to parse multipart data');
    reply.status(400);
    return createOcrErrorResponse(
      'Bad Request',
      'INVALID_IMAGE',
      'No image was provided'
    );
  }

  if (!file) {
    reply.status(400);
    return createOcrErrorResponse(
      'Bad Request',
      'INVALID_IMAGE',
      'No image was provided'
    );
  }

  // Validate MIME type
  if (!isAllowedMimeType(file.mimetype)) {
    reply.status(400);
    return createOcrErrorResponse(
      'Bad Request',
      'INVALID_IMAGE',
      'Only PNG, JPEG, GIF, WebP formats are supported'
    );
  }

  // Read file into buffer
  const chunks: Buffer[] = [];
  let totalSize = 0;

  try {
    for await (const chunk of file.file) {
      totalSize += chunk.length;
      if (totalSize > MAX_OCR_FILE_SIZE) {
        reply.status(400);
        return createOcrErrorResponse(
          'Bad Request',
          'FILE_TOO_LARGE',
          'File size exceeds 10MB limit'
        );
      }
      chunks.push(chunk);
    }
  } catch (error) {
    request.log.error({ error }, 'Failed to read uploaded file');
    reply.status(400);
    return createOcrErrorResponse(
      'Bad Request',
      'INVALID_IMAGE',
      'Failed to read image file'
    );
  }

  const imageBuffer = Buffer.concat(chunks);

  // Perform OCR
  try {
    const result = await performOcr(imageBuffer);
    return result;
  } catch (error: any) {
    request.log.error({ error: error?.message || error, stack: error?.stack }, 'OCR processing failed');
    reply.status(500);
    return createOcrErrorResponse(
      'Internal Server Error',
      'OCR_FAILED',
      'Failed to process image'
    );
  }
}
