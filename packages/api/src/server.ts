import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import type { MgtdConfig } from 'meme-gtd-config';

export interface BuildAppOptions {
  config: MgtdConfig;
  corsAllowedOrigins?: string[];
  logger?: {
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

  // Initialize Fastify with logger configuration
  const app = Fastify({
    logger: {
      level: logger?.level ?? 'info',
      ...(logger?.prettyPrint && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }),
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Register Zod validator and serializer compilers
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Store config in app context for handlers to access
  app.decorate('config', config);

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
    transform: ({ schema, url }) => {
      // Transform Zod schemas to JSON Schema for OpenAPI
      return { schema, url };
    },
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

  return app;
}

// Type augmentation for Fastify instance
declare module 'fastify' {
  interface FastifyInstance {
    config: MgtdConfig;
  }
}
