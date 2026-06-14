import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { HealthResponseSchema, type HealthResponse } from '../schemas/healthSchemas.js';

const packageVersion = (): string => {
  try {
    const packageJsonUrl = new URL('../../package.json', import.meta.url);
    const { version } = JSON.parse(readFileSync(packageJsonUrl, 'utf-8')) as { version?: string };
    return version ?? 'unknown';
  } catch {
    return 'unknown';
  }
};

const VERSION = packageVersion();

/**
 * Register health check route
 * @param app Fastify instance
 */
export async function healthRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // GET /api/health - Health check (server + database)
  server.get(
    '/api/health',
    {
      schema: {
        tags: ['System'],
        summary: 'Health check',
        description:
          'Report server and database health. Returns 200 when healthy, 503 when the database is unreachable.',
        operationId: 'getHealth',
        response: {
          200: HealthResponseSchema,
          503: HealthResponseSchema,
        },
      },
    },
    async (request, reply) => {
      let dbStatus: 'ok' | 'error' = 'ok';
      let schemaVersion: string | null = null;
      try {
        const row = request.server.db
          .prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1')
          .get() as { version: string } | undefined;
        schemaVersion = row?.version ?? null;
      } catch (error) {
        request.log.error({ err: error }, 'Health check: database query failed');
        dbStatus = 'error';
      }

      const payload: HealthResponse = {
        status: dbStatus,
        version: VERSION,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        db: { status: dbStatus, schemaVersion },
      };

      return reply.status(dbStatus === 'ok' ? 200 : 503).send(payload);
    }
  );
}
