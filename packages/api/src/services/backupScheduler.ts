import { setInterval, clearInterval } from 'node:timers';
import type { FastifyBaseLogger } from 'fastify';
import { createBackup, latestBackupTime, defaultBackupDir } from 'meme-gtd-db';

interface BackupSchedulerOptions {
  dbPath: string;
  backupDir?: string;
  keep?: number;
  intervalMs?: number;
  logger: FastifyBaseLogger;
}

interface BackupScheduler {
  stop: () => void;
}

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Periodically back up the database while the API server runs.
 *
 * On start, a backup is taken immediately if none exists or the latest one
 * is older than the interval; afterwards backups run on a fixed interval.
 * Failures are logged but never crash the server, and the timer is unref'd
 * so it does not keep the process alive during shutdown.
 */
export const startBackupScheduler = (options: BackupSchedulerOptions): BackupScheduler => {
  const { dbPath, keep, logger } = options;
  const backupDir = options.backupDir ?? defaultBackupDir(dbPath);
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  const runBackup = async (): Promise<void> => {
    try {
      const result = await createBackup(dbPath, { backupDir, keep });
      logger.info(
        {
          backupPath: result.backupPath,
          sizeBytes: result.sizeBytes,
          prunedFiles: result.prunedFiles,
        },
        'Database backup completed'
      );
    } catch (error) {
      logger.error({ err: error, dbPath, backupDir }, 'Database backup failed');
    }
  };

  const maybeRunInitialBackup = async (): Promise<void> => {
    try {
      const latest = await latestBackupTime(backupDir);
      if (!latest || Date.now() - latest.getTime() >= intervalMs) {
        await runBackup();
      }
    } catch (error) {
      logger.error({ err: error, backupDir }, 'Could not determine latest backup time');
    }
  };

  void maybeRunInitialBackup();

  const timer = setInterval(() => {
    void runBackup();
  }, intervalMs);
  timer.unref();

  return {
    stop: () => {
      clearInterval(timer);
    },
  };
};
