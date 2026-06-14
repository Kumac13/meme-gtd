import pino from 'pino';
import type { MgtdConfig } from 'meme-gtd-config';

let loggerInstance: pino.Logger | null = null;

export interface LogTargetOptions {
  /** Pretty-print to stdout (development). */
  pretty?: boolean;
  /** Also write JSON logs to this file with daily rotation (7 generations kept). */
  logFile?: string;
}

/**
 * Build pino transport targets: always stdout, plus an optional rotating
 * file target (pino-roll, daily rotation, 7 generations) when logFile is set.
 */
export const buildLogTargets = (options: LogTargetOptions = {}): pino.TransportTargetOptions[] => {
  const targets: pino.TransportTargetOptions[] = [
    options.pretty
      ? { target: 'pino-pretty', options: { colorize: true } }
      : { target: 'pino/file', options: { destination: 1 } }
  ];
  if (options.logFile) {
    targets.push({
      target: 'pino-roll',
      options: {
        file: options.logFile,
        frequency: 'daily',
        mkdir: true,
        limit: { count: 7 }
      }
    });
  }
  return targets;
};

export const createLogger = (config?: MgtdConfig): pino.Logger => {
  if (loggerInstance) {
    return loggerInstance;
  }

  const pretty = process.env.NODE_ENV !== 'production';
  const logFile = process.env.MGTD_LOG_FILE;

  loggerInstance = pino({
    name: 'mgtd',
    level: process.env.MGTD_LOG_LEVEL ?? 'info',
    // Without pretty-print or a log file, log straight to stdout with no
    // transport worker (previous production behavior)
    transport:
      pretty || logFile ? { targets: buildLogTargets({ pretty, logFile }) } : undefined
  });

  if (config) {
    loggerInstance.debug({ config }, 'Loaded config');
  }

  return loggerInstance;
};

export const getLogger = (): pino.Logger => {
  if (!loggerInstance) {
    return createLogger();
  }
  return loggerInstance;
};
