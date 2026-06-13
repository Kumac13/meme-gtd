import { z } from 'zod';

/**
 * Schema for health check response
 */
export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'error']).describe('Overall server health'),
  version: z.string().describe('API server version'),
  uptimeSeconds: z.number().describe('Process uptime in seconds'),
  timestamp: z.string().describe('Current server time (ISO 8601)'),
  db: z
    .object({
      status: z.enum(['ok', 'error']).describe('Database connectivity'),
      schemaVersion: z
        .string()
        .nullable()
        .describe('Latest applied migration version, null if unavailable'),
    })
    .describe('Database health details'),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
