import Database from 'better-sqlite3';
import path from 'node:path';
import type { MgtdConfig } from 'meme-gtd-config';
import { applyMigrations } from './migrate.js';

export { applyMigrations } from './migrate.js';

export interface DatabaseOptions {
  readonly dbPath: string;
  readonly pragma?: Record<string, string | number>;
}

export const openDatabase = (options: DatabaseOptions): Database.Database => {
  const dbPath = path.resolve(options.dbPath);
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  if (options.pragma) {
    for (const [key, value] of Object.entries(options.pragma)) {
      db.pragma(`${key} = ${value}`);
    }
  }
  return db;
};

export const ensureDatabase = (config: MgtdConfig): Database.Database => {
  applyMigrations(config.dbPath);
  return openDatabase({ dbPath: config.dbPath });
};

export type SqliteRow = Record<string, unknown>;

export * from './memoRepository.js';
