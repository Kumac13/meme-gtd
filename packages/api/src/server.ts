import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider
} from 'fastify-type-provider-zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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
  requestTimeoutMs?: number;
}

/**
 * Build and configure the Fastify application instance
 * @param options Build options including config and logger settings
 * @returns Configured Fastify instance with ZodTypeProvider
 */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config, corsAllowedOrigins = ['*'], logger, requestTimeoutMs } = options;

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
    requestTimeout: requestTimeoutMs ?? 30_000,
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

  // Custom transform using zod-to-json-schema with OpenAPI 3 target
  const openApiTransform = ({ schema, url }: { schema: any; url: string }) => {
    if (!schema) {
      return { schema: undefined, url };
    }

    const transformed: any = { ...schema };
    const transformZodSchema = (value: any) =>
      zodToJsonSchema(value, {
        target: 'openApi3',
        $refStrategy: 'none',
      });

    const keysToTransform = ['body', 'querystring', 'params', 'headers'];

    for (const key of keysToTransform) {
      const value = schema[key];
      if (!value) continue;
      if (value && value._def) {
        try {
          transformed[key] = transformZodSchema(value);
        } catch (error) {
          console.error(`Error transforming schema for ${key} at ${url}:`, error);
          throw error;
        }
      }
    }

    if (schema.response && typeof schema.response === 'object') {
      const responses: Record<string, any> = {};

      for (const [statusCode, responseSchema] of Object.entries(schema.response as Record<string, any>)) {
        if (!responseSchema) continue;

        if (responseSchema._def) {
          try {
            responses[statusCode] = transformZodSchema(responseSchema);
          } catch (error) {
            console.error(`Error transforming response schema for status ${statusCode} at ${url}:`, error);
            throw error;
          }
        } else {
          responses[statusCode] = responseSchema;
        }
      }

      transformed.response = responses;
    }

    return {
      schema: transformed,
      url,
    };
  };

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
        { name: 'Projects', description: 'Project management endpoints' },
        { name: 'Comments', description: 'Comment management endpoints' },
      ],
    },
    transform: openApiTransform,
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

  // Register routes
  const { memoRoutes } = await import('./routes/memos.js');
  await app.register(memoRoutes);

  const { taskRoutes } = await import('./routes/tasks.js');
  await app.register(taskRoutes);

  const { labelRoutes } = await import('./routes/labels.js');
  await app.register(labelRoutes);

  const { linkRoutes } = await import('./routes/links.js');
  await app.register(linkRoutes);

  const { projectRoutes } = await import('./routes/projects.js');
  await app.register(projectRoutes);

  // Register static file serving for Web UI (after API routes)
  await app.register(import('@fastify/static'), {
    root: new URL('../../web/dist', import.meta.url).pathname,
    prefix: '/',
  });

  // SPA fallback: serve index.html for all non-API routes
  app.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api')) {
      reply.sendFile('index.html');
    } else {
      reply.status(404).send({
        error: 'Not Found',
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      });
    }
  });

  return app;
}

// Type augmentation for Fastify instance
declare module 'fastify' {
  interface FastifyInstance {
    config: MgtdConfig;
    db: Database.Database;
  }
}
