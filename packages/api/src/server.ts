import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import type { MgtdConfig } from 'meme-gtd-config';

export interface BuildAppOptions {
  config: MgtdConfig;
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
  const { config, logger } = options;

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
