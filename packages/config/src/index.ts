import { homedir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { z } from 'zod';

const configSchema = z.object({
  dbPath: z.string().min(1),
  mode: z.enum(['local', 'remote']).default('local'),
  schemaVersion: z.string().min(1),
  updatedAt: z.string().optional()
});

export type MgtdConfig = z.infer<typeof configSchema>;

export interface LoadConfigOptions {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
  createIfMissing?: boolean;
}

const DEFAULT_CONFIG_PATH = path.join(
  homedir(),
  '.config',
  'mgtd',
  'context.json'
);

const DEFAULT_CONFIG: MgtdConfig = {
  dbPath: path.join(homedir(), '.local', 'share', 'mgtd', 'issues.db'),
  mode: 'local',
  schemaVersion: '001_init',
  updatedAt: new Date().toISOString()
};

export const resolveConfigPath = (env: NodeJS.ProcessEnv = process.env): string => {
  const fromEnv = env.MGTD_CONFIG_PATH;
  if (fromEnv && fromEnv.trim().length > 0) {
    return path.resolve(fromEnv);
  }
  return DEFAULT_CONFIG_PATH;
};

export const loadConfig = async (
  options: LoadConfigOptions = {}
): Promise<{ config: MgtdConfig; path: string }> => {
  const env = options.env ?? process.env;
  const configPath = path.resolve(options.configPath ?? resolveConfigPath(env));

  if (!(await fs.pathExists(configPath))) {
    if (options.createIfMissing) {
      await writeConfig(DEFAULT_CONFIG, configPath);
      return { config: DEFAULT_CONFIG, path: configPath };
    }
    return { config: DEFAULT_CONFIG, path: configPath };
  }

  const raw = await fs.readFile(configPath, 'utf-8');
  const parsed = configSchema.parse(JSON.parse(raw));
  return { config: parsed, path: configPath };
};

export const writeConfig = async (config: MgtdConfig, configPath?: string): Promise<void> => {
  const destination = configPath ?? resolveConfigPath();
  await fs.ensureDir(path.dirname(destination));
  const payload = {
    ...config,
    updatedAt: new Date().toISOString()
  } satisfies MgtdConfig;
  await fs.writeJson(destination, payload, { spaces: 2 });
};

export const mergeConfigWithFlags = (
  base: MgtdConfig,
  overrides: Partial<Pick<MgtdConfig, 'dbPath' | 'mode'>>
): MgtdConfig => {
  const merged: MgtdConfig = {
    ...base,
    ...overrides,
    updatedAt: new Date().toISOString()
  };
  return configSchema.parse(merged);
};

