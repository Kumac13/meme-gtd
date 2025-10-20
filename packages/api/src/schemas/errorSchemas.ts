import { z } from 'zod';

/**
 * Schema for standard error response
 */
export const ErrorResponseSchema = z.object({
  error: z.string().describe('Error type or name'),
  code: z.string().optional().describe('Error code'),
  message: z.string().describe('Human-readable error message'),
  stack: z.string().optional().describe('Stack trace (only in development)'),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Schema for validation error details
 */
export const ValidationErrorDetailSchema = z.object({
  path: z.string().describe('Field path that failed validation'),
  message: z.string().describe('Validation error message'),
  code: z.string().describe('Validation error code'),
});

export type ValidationErrorDetail = z.infer<typeof ValidationErrorDetailSchema>;

/**
 * Schema for validation error response
 */
export const ValidationErrorResponseSchema = z.object({
  error: z.string().describe('Error type (always "Validation Error")'),
  code: z.string().describe('Error code'),
  message: z.string().describe('Human-readable error message'),
  details: z.array(ValidationErrorDetailSchema).describe('Array of validation error details'),
});

export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
