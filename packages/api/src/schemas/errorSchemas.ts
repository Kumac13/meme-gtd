import { z } from 'zod';

/**
 * Schema for standard error response
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  message: z.string(),
  stack: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Schema for validation error details
 */
export const ValidationErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
  code: z.string(),
});

export type ValidationErrorDetail = z.infer<typeof ValidationErrorDetailSchema>;

/**
 * Schema for validation error response
 */
export const ValidationErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  message: z.string(),
  details: z.array(ValidationErrorDetailSchema),
});

export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
