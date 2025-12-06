/**
 * Handlers for attachment (image upload/download) operations
 */

import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import {
  type AttachmentResponse,
  type AttachmentError,
  type FilenameParams,
  type MimeType,
  isAllowedMimeType,
  isAllowedExtension,
  getExtensionFromMimeType,
  MAX_FILE_SIZE,
} from '../schemas/attachmentSchemas.js';
import {
  ensureAttachmentsDir,
  getAttachmentPath,
  attachmentExists,
} from '../utils/attachments.js';

/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Create an error response
 */
function createErrorResponse(
  error: string,
  code: AttachmentError['code'],
  message: string
): AttachmentError {
  return { error, code, message };
}

/**
 * Upload an image attachment
 * POST /api/attachments
 */
export async function uploadAttachment(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AttachmentResponse | AttachmentError> {
  // Get the uploaded file
  let file: MultipartFile | undefined;
  try {
    file = await request.file();
  } catch (error) {
    request.log.error({ error }, 'Failed to parse multipart data');
    reply.status(400);
    return createErrorResponse(
      'Bad Request',
      'NO_FILE_UPLOADED',
      'No file was uploaded'
    );
  }

  if (!file) {
    reply.status(400);
    return createErrorResponse(
      'Bad Request',
      'NO_FILE_UPLOADED',
      'No file was uploaded'
    );
  }

  // Validate MIME type
  if (!isAllowedMimeType(file.mimetype)) {
    reply.status(400);
    return createErrorResponse(
      'Bad Request',
      'INVALID_FILE_TYPE',
      'Only PNG, JPEG, GIF, WebP formats are supported'
    );
  }

  // Validate file extension
  const originalExt = path.extname(file.filename).slice(1).toLowerCase();
  if (!isAllowedExtension(originalExt)) {
    reply.status(400);
    return createErrorResponse(
      'Bad Request',
      'INVALID_FILE_TYPE',
      'Only PNG, JPEG, GIF, WebP formats are supported'
    );
  }

  // Generate UUID and filename
  const uuid = randomUUID();
  const ext = getExtensionFromMimeType(file.mimetype as MimeType);
  const filename = `${uuid}.${ext}`;

  // Ensure directory exists
  let attachmentsDir: string;
  try {
    attachmentsDir = await ensureAttachmentsDir();
  } catch (error) {
    request.log.error({ error }, 'Failed to create attachments directory');
    reply.status(500);
    return createErrorResponse(
      'Internal Server Error',
      'STORAGE_ERROR',
      'Failed to save image'
    );
  }

  // Save file to disk
  const filePath = path.join(attachmentsDir, filename);
  let fileSize = 0;

  try {
    const writeStream = createWriteStream(filePath);

    // Track file size while streaming
    file.file.on('data', (chunk: Buffer) => {
      fileSize += chunk.length;
      if (fileSize > MAX_FILE_SIZE) {
        file!.file.destroy(new Error('File too large'));
      }
    });

    await pipeline(file.file, writeStream);

    // Check if file was truncated due to size limit
    if (file.file.truncated) {
      // Clean up the partial file
      await fs.unlink(filePath).catch(() => {});
      reply.status(400);
      return createErrorResponse(
        'Bad Request',
        'FILE_TOO_LARGE',
        'File size exceeds 10MB limit'
      );
    }
  } catch (error: any) {
    // Clean up on error
    await fs.unlink(filePath).catch(() => {});

    if (error.message === 'File too large') {
      reply.status(400);
      return createErrorResponse(
        'Bad Request',
        'FILE_TOO_LARGE',
        'File size exceeds 10MB limit'
      );
    }

    request.log.error({ error, filePath }, 'Failed to save attachment file');
    reply.status(500);
    return createErrorResponse(
      'Internal Server Error',
      'STORAGE_ERROR',
      'Failed to save image'
    );
  }

  // Build response
  const absolutePath = filePath;
  const markdownRef = `![image](${absolutePath})`;

  reply.status(201);
  return {
    id: uuid,
    filename,
    absolutePath,
    markdownRef,
    mimeType: file.mimetype as MimeType,
    size: fileSize,
  };
}

/**
 * Get an attachment file
 * GET /api/attachments/:filename
 */
export async function getAttachment(
  request: FastifyRequest<{ Params: FilenameParams }>,
  reply: FastifyReply
): Promise<void> {
  const { filename } = request.params;

  // Check if file exists
  const exists = await attachmentExists(filename);
  if (!exists) {
    reply.status(404).send(
      createErrorResponse(
        'Not Found',
        'FILE_NOT_FOUND',
        'Image not found'
      )
    );
    return;
  }

  // Get file path and determine content type
  const filePath = getAttachmentPath(filename);
  const ext = path.extname(filename).slice(1);
  const contentType = getMimeTypeFromExtension(ext);

  // Read and send file
  try {
    const fileBuffer = await fs.readFile(filePath);
    reply
      .header('Content-Type', contentType)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(fileBuffer);
  } catch (error) {
    request.log.error({ error, filePath }, 'Failed to read attachment file');
    reply.status(500).send(
      createErrorResponse(
        'Internal Server Error',
        'STORAGE_ERROR',
        'Failed to read image'
      )
    );
  }
}
