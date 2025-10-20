import { loadContext, type MgtdConfig } from 'meme-gtd-config';
import { parseArgs } from 'node:util';

export interface ServerConfig {
  port: number;
  host: string;
  corsAllowedOrigins: string[];
  logLevel: string;
  nodeEnv: string;
  mgtdConfig: MgtdConfig;
}

/**
 * Load server configuration from CLI arguments, environment variables, and defaults
 * Priority: CLI args > environment variables > defaults
 */
export async function loadConfig(): Promise<ServerConfig> {
  // Parse CLI arguments
  const { values } = parseArgs({
    options: {
      port: {
        type: 'string',
        short: 'p',
      },
      host: {
        type: 'string',
        short: 'h',
      },
      db: {
        type: 'string',
        short: 'd',
      },
      config: {
        type: 'string',
        short: 'c',
      },
    },
    strict: false,
  });

  // Load mgtd config (database path and other settings)
  const configPath = values.config ?? process.env.MGTD_CONFIG_PATH;
  const dbPath = values.db ?? process.env.DB_PATH;

  const mgtdConfig = await loadContext(configPath);
  if (dbPath) {
    mgtdConfig.dbPath = dbPath;
  }

  // Parse CORS origins (comma-separated list)
  const corsOriginsEnv = process.env.CORS_ALLOWED_ORIGINS ?? '*';
  const corsAllowedOrigins = corsOriginsEnv === '*'
    ? ['*']
    : corsOriginsEnv.split(',').map(o => o.trim());

  return {
    port: parseInt(values.port ?? process.env.PORT ?? '3000', 10),
    host: values.host ?? process.env.HOST ?? '0.0.0.0',
    corsAllowedOrigins,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    mgtdConfig,
  };
}
