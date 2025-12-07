/**
 * Zod schemas for attachment API endpoints
 */

import { z } from 'zod';

/**
 * Allowed MIME types for image uploads
 */
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

/**
 * Allowed file extensions for image uploads
 */
export const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const;

/**
 * Maximum file size in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * MIME type enum schema
 */
const MimeTypeSchema = z.enum(ALLOWED_MIME_TYPES);
export type MimeType = z.infer<typeof MimeTypeSchema>;

/**
 * Response schema for successful attachment upload
 */
export const AttachmentResponseSchema = z.object({
  id: z.string().describe('UUID of the uploaded image'),
  filename: z.string().describe('Saved filename (uuid.ext format)'),
  absolutePath: z.string().describe('Absolute path to the image file'),
  markdownRef: z.string().describe('Markdown image reference for editor insertion'),
  mimeType: MimeTypeSchema.describe('MIME type of the image'),
  size: z.number().int().positive().describe('File size in bytes'),
});
export type AttachmentResponse = z.infer<typeof AttachmentResponseSchema>;

/**
 * Error codes for attachment operations
 */
const AttachmentErrorCode = z.enum([
  'INVALID_FILE_TYPE',
  'FILE_TOO_LARGE',
  'FILE_NOT_FOUND',
  'STORAGE_ERROR',
  'NO_FILE_UPLOADED',
]);
export type AttachmentErrorCodeType = z.infer<typeof AttachmentErrorCode>;

/**
 * Error response schema for attachment operations
 */
export const AttachmentErrorSchema = z.object({
  error: z.string().describe('Error type'),
  code: AttachmentErrorCode.describe('Error code'),
  message: z.string().describe('User-friendly error message'),
});
export type AttachmentError = z.infer<typeof AttachmentErrorSchema>;

/**
 * Path parameters schema for attachment retrieval
 */
export const FilenameParamsSchema = z.object({
  filename: z.string().regex(
    /^[a-f0-9-]+\.(png|jpg|jpeg|gif|webp)$/i,
    'Invalid filename format'
  ).describe('Attachment filename (uuid.ext format)'),
});
export type FilenameParams = z.infer<typeof FilenameParamsSchema>;

/**
 * Validate MIME type against allowed types
 */
export function isAllowedMimeType(mimeType: string): mimeType is MimeType {
  return ALLOWED_MIME_TYPES.includes(mimeType as MimeType);
}

/**
 * Validate file extension against allowed extensions
 */
export function isAllowedExtension(ext: string): boolean {
  return ALLOWED_EXTENSIONS.includes(ext.toLowerCase() as typeof ALLOWED_EXTENSIONS[number]);
}

/**
 * Get extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: MimeType): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
  }
}
