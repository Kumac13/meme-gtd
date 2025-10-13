import pino from 'pino';
import type { MgtdConfig } from 'meme-gtd-config';

let loggerInstance: pino.Logger | null = null;

export const createLogger = (config?: MgtdConfig): pino.Logger => {
  if (loggerInstance) {
    return loggerInstance;
  }

  loggerInstance = pino({
    name: 'mgtd',
    level: process.env.MGTD_LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: { colorize: true }
          }
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
