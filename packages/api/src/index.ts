import { join } from 'node:path';
import { homedir } from 'node:os';
import { buildApp } from './server.js';
import { loadConfig } from './config.js';

// Load .env from ~/.config/mgtd/.env (Node.js 22 native)
// Shell environment variables take precedence over .env values
try {
  process.loadEnvFile(join(homedir(), '.config', 'mgtd', '.env'));
} catch {
  // .env file is optional
}

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
    let isShuttingDown = false;
    const signals = ['SIGINT', 'SIGTERM'] as const;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;

      app.log.info(`Received ${signal}, starting graceful shutdown...`);
      try {
        await app.close();
        app.log.info('Server closed successfully');
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    };

    for (const signal of signals) {
      process.on(signal, () => shutdown(signal));
    }

    // Handle uncaught exceptions and rejections
    process.on('uncaughtException', (err) => {
      app.log.error({ err }, 'Uncaught exception');
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      app.log.error({ reason }, 'Unhandled rejection');
      shutdown('unhandledRejection');
    });
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
