import { buildApp } from './server.js';
import { loadConfig } from './config.js';

/**
 * Start the API server with graceful shutdown handling
 */
async function start() {
  try {
    // Load configuration from environment and CLI arguments
    const config = await loadConfig();

    // Build Fastify application
    const app = await buildApp({
      config: config.mgtdConfig,
      corsAllowedOrigins: config.corsAllowedOrigins,
      logger: {
        level: config.logLevel,
        prettyPrint: config.nodeEnv === 'development',
      },
    });

    // Start listening
    await app.listen({
      port: config.port,
      host: config.host,
    });

    app.log.info(
      `meme-gtd API server listening on http://${config.host}:${config.port}`
    );
    app.log.info(`API documentation available at http://${config.host}:${config.port}/api-docs`);

    // Graceful shutdown handler
    const signals = ['SIGINT', 'SIGTERM'] as const;
    for (const signal of signals) {
      process.on(signal, async () => {
        app.log.info(`Received ${signal}, starting graceful shutdown...`);
        try {
          await app.close();
          app.log.info('Server closed successfully');
          process.exit(0);
        } catch (err) {
          app.log.error('Error during shutdown:', err);
          process.exit(1);
        }
      });
    }
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Run server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { start, buildApp };
