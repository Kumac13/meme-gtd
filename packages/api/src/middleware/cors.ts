import type { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';

interface CorsOptions {
  allowedOrigins: string[];
}

/**
 * Register CORS middleware with custom origins configuration
 * @param app Fastify instance
 * @param options CORS options
 */
export async function registerCors(app: FastifyInstance, options: CorsOptions) {
  const { allowedOrigins } = options;

  await app.register(fastifyCors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Allow any origin if '*' is configured
      if (allowedOrigins.includes('*')) {
        callback(null, true);
        return;
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}
