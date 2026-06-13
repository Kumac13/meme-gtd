import { loadConfig as loadMgtdConfig, type MgtdConfig } from 'meme-gtd-config';
import { parseArgs } from 'node:util';

interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  keep: number;
  backupDir?: string;
}

interface ServerConfig {
  port: number;
  host: string;
  corsAllowedOrigins: string[];
  logLevel: string;
  logFile?: string;
  nodeEnv: string;
  backup: BackupConfig;
  mgtdConfig: MgtdConfig;
}

const parsePositiveNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

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
  const configPath = typeof values.config === 'string' ? values.config : process.env.MGTD_CONFIG_PATH;
  const dbPath = typeof values.db === 'string' ? values.db : process.env.DB_PATH;

  const { config: mgtdConfig } = await loadMgtdConfig({
    configPath,
    createIfMissing: true,
  });

  if (dbPath) {
    mgtdConfig.dbPath = dbPath;
  }

  // Parse CORS origins (comma-separated list)
  const corsOriginsEnv = process.env.CORS_ALLOWED_ORIGINS ?? '*';
  const corsAllowedOrigins = corsOriginsEnv === '*'
    ? ['*']
    : corsOriginsEnv.split(',').map(o => o.trim());

  const port = typeof values.port === 'string' ? values.port : process.env.PORT ?? '3000';
  const host = typeof values.host === 'string' ? values.host : process.env.HOST ?? '0.0.0.0';

  const logFileEnv = process.env.MGTD_LOG_FILE;
  const backupDirEnv = process.env.MGTD_BACKUP_DIR;

  return {
    port: parseInt(port, 10),
    host,
    corsAllowedOrigins,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    logFile: logFileEnv && logFileEnv.trim().length > 0 ? logFileEnv : undefined,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    backup: {
      enabled: process.env.MGTD_BACKUP_ENABLED !== 'false',
      intervalHours: parsePositiveNumber(process.env.MGTD_BACKUP_INTERVAL_HOURS, 24),
      keep: parsePositiveNumber(process.env.MGTD_BACKUP_KEEP, 7),
      backupDir: backupDirEnv && backupDirEnv.trim().length > 0 ? backupDirEnv : undefined,
    },
    mgtdConfig,
  };
}
