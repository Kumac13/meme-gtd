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

export const PRODUCTION_DATA_DIR = path.join(homedir(), '.local', 'share', 'mgtd');

export const isProductionDbPath = (dbPath: string): boolean => {
  const relative = path.relative(PRODUCTION_DATA_DIR, path.resolve(dbPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

// Hard guard against Issue #48 (production DB wiped during testing):
// when the caller declares a test session via MGTD_ENV=test, never allow
// the resolved dbPath to land in the production data directory.
const assertTestEnvSafety = (dbPath: string, env: NodeJS.ProcessEnv): void => {
  if (env.MGTD_ENV === 'test' && isProductionDbPath(dbPath)) {
    throw new Error(
      `MGTD_ENV=test but dbPath resolves to the production data directory (${path.resolve(dbPath)}). ` +
        'Refusing to continue. Set DB_PATH to a test database or unset MGTD_ENV.'
    );
  }
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
    const fallback: MgtdConfig = { ...DEFAULT_CONFIG };
    // DB_PATH must take effect even without a config file; previously this
    // branch ignored it and silently fell back to the production database
    if (env.DB_PATH && env.DB_PATH.trim().length > 0) {
      fallback.dbPath = path.resolve(env.DB_PATH);
    }
    assertTestEnvSafety(fallback.dbPath, env);
    if (options.createIfMissing) {
      await writeConfig(fallback, configPath);
    }
    return { config: fallback, path: configPath };
  }

  const raw = await fs.readFile(configPath, 'utf-8');
  const parsed = configSchema.parse(JSON.parse(raw));

  // Resolve relative dbPath to absolute path
  // If dbPath is relative, resolve it from the current working directory
  // This ensures consistent behavior regardless of where the process is started
  if (!path.isAbsolute(parsed.dbPath)) {
    parsed.dbPath = path.resolve(process.cwd(), parsed.dbPath);
  }

  // Override with DB_PATH environment variable if provided
  if (env.DB_PATH && env.DB_PATH.trim().length > 0) {
    parsed.dbPath = path.resolve(env.DB_PATH);
  }

  assertTestEnvSafety(parsed.dbPath, env);

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

