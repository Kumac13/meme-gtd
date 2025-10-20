import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider
} from 'fastify-type-provider-zod';
import type { MgtdConfig } from 'meme-gtd-config';
import { ensureDatabase } from 'meme-gtd-db';
import type Database from 'better-sqlite3';

export interface BuildAppOptions {
  config: MgtdConfig;
  corsAllowedOrigins?: string[];
  logger?:
    | FastifyServerOptions['logger']
    | {
        level?: string;
        prettyPrint?: boolean;
      };
}

/**
 * Build and configure the Fastify application instance
 * @param options Build options including config and logger settings
 * @returns Configured Fastify instance with ZodTypeProvider
 */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config, corsAllowedOrigins = ['*'], logger } = options;

  let fastifyLogger: FastifyServerOptions['logger'];
  if (logger && typeof (logger as any).info === 'function') {
    fastifyLogger = logger as FastifyServerOptions['logger'];
  } else {
    const loggerOptions = (logger as { level?: string; prettyPrint?: boolean; stream?: NodeJS.WritableStream }) ?? {};
    fastifyLogger = {
      level: loggerOptions.level ?? 'info',
      ...(loggerOptions.stream ? { stream: loggerOptions.stream } : {}),
      ...(loggerOptions.prettyPrint && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }),
    };
  }

  // Initialize Fastify with logger configuration
  const app = Fastify({
    logger: fastifyLogger,
    // Request body size limit: 10MB (sufficient for large memo/task bodies)
    bodyLimit: 10 * 1024 * 1024, // 10MB in bytes
  }).withTypeProvider<ZodTypeProvider>();

  // Register Zod validator and serializer compilers
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Add request/response logging hooks
  app.addHook('onRequest', async (request) => {
    // Store request start time for response time calculation
    (request as any).startTime = Date.now();

    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
      },
      'Incoming request'
    );
  });

  app.addHook('onResponse', async (request, reply) => {
    const startTime = (request as any).startTime;
    const responseTime = startTime ? Date.now() - startTime : 0;

    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: `${responseTime}ms`,
      },
      'Request completed'
    );
  });

  // Open database connection once and share across all requests
  const db = ensureDatabase(config);

  // Store config and db in app context for handlers to access
  app.decorate('config', config);
  app.decorate('db', db);

  // Close database connection when server shuts down
  app.addHook('onClose', async () => {
    db.close();
  });

  // Register CORS middleware
  const { registerCors } = await import('./middleware/cors.js');
  await registerCors(app, { allowedOrigins: corsAllowedOrigins });

  // Register Swagger OpenAPI plugin
  await app.register(import('@fastify/swagger'), {
    openapi: {
      info: {
        title: 'meme-gtd API',
        description: 'HTTP REST API for meme-gtd CLI operations',
        version: '0.6.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'Memos', description: 'Memo management endpoints' },
        { name: 'Tasks', description: 'Task management endpoints' },
        { name: 'Labels', description: 'Label management endpoints' },
        { name: 'Links', description: 'Link management endpoints' },
        { name: 'Comments', description: 'Comment management endpoints' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  // Register Swagger UI
  await app.register(import('@fastify/swagger-ui'), {
    routePrefix: '/api-docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Register global error handler (must be imported after app is created)
  const { errorHandler } = await import('./middleware/errorHandler.js');
  app.setErrorHandler(errorHandler);

  // Register 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  // Register routes
  const { memoRoutes } = await import('./routes/memos.js');
  await app.register(memoRoutes);

  const { taskRoutes } = await import('./routes/tasks.js');
  await app.register(taskRoutes);

  const { labelRoutes } = await import('./routes/labels.js');
  await app.register(labelRoutes);

  const { linkRoutes } = await import('./routes/links.js');
  await app.register(linkRoutes);

  return app;
}

// Type augmentation for Fastify instance
declare module 'fastify' {
  interface FastifyInstance {
    config: MgtdConfig;
    db: Database.Database;
  }
}
