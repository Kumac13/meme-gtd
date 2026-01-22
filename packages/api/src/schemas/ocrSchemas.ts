import { z } from 'zod';

/**
 * Schema for a single OCR region (detected text region)
 */
export const OcrRegionSchema = z.object({
  text: z.string().describe('Recognized text in this region'),
  confidence: z.number().min(0).max(1).describe('Recognition confidence (0-1)'),
  bbox: z
    .object({
      x: z.number().describe('X coordinate of top-left corner'),
      y: z.number().describe('Y coordinate of top-left corner'),
      width: z.number().describe('Width of bounding box'),
      height: z.number().describe('Height of bounding box'),
    })
    .describe('Bounding box of the text region'),
});

export type OcrRegion = z.infer<typeof OcrRegionSchema>;

/**
 * Schema for successful OCR response
 */
export const OcrResponseSchema = z.object({
  text: z.string().describe('Full extracted text'),
  regions: z.array(OcrRegionSchema).describe('Individual text regions'),
  processingTimeMs: z.number().describe('Processing time in milliseconds'),
});

export type OcrResponse = z.infer<typeof OcrResponseSchema>;

/**
 * Error codes for OCR operations
 */
export const OcrErrorCodeSchema = z.enum([
  'INVALID_IMAGE',
  'OCR_FAILED',
  'FILE_TOO_LARGE',
]);

export type OcrErrorCode = z.infer<typeof OcrErrorCodeSchema>;

/**
 * Schema for OCR error response
 */
export const OcrErrorResponseSchema = z.object({
  error: z.string().describe('Error type'),
  code: OcrErrorCodeSchema.describe('OCR-specific error code'),
  message: z.string().describe('Human-readable error message'),
});

export type OcrErrorResponse = z.infer<typeof OcrErrorResponseSchema>;
