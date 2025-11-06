import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

const schemaDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../schema'
);

const migrations = [
  { version: '001_init', file: path.join(schemaDir, '001_init.sql') },
  { version: '002_add_project_view_meta', file: path.join(schemaDir, '002_add_project_view_meta.sql') },
  { version: '003_add_fts5', file: path.join(schemaDir, '003_add_fts5.sql') }
] as const;

const prepareDatabase = (db: Database.Database): void => {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
};

export const applyMigrations = (dbPath: string): MigrationResult => {
  const absolutePath = path.resolve(dbPath);
  fs.ensureDirSync(path.dirname(absolutePath));
  const db = new Database(absolutePath);
  prepareDatabase(db);

  const result: MigrationResult = { applied: [], skipped: [] };

  const hasMigrationTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
    .get();

  if (!hasMigrationTable) {
    db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))"
    );
  }

  for (const migration of migrations) {
    if (!fs.existsSync(migration.file)) {
      throw new Error(`Migration file not found: ${migration.file}`);
    }

    const already = db
      .prepare('SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1')
      .get(migration.version);

    if (already) {
      result.skipped.push(migration.version);
      continue;
    }

    const sql = fs.readFileSync(migration.file, 'utf-8');
    db.exec(sql);
    result.applied.push(migration.version);
  }

  db.close();
  return result;
};

export const validateMigrationFileList = async (): Promise<void> => {
  await Promise.all(
    migrations.map(async (migration) => {
      const exists = await fs.pathExists(migration.file);
      if (!exists) {
        throw new Error(`Missing migration file: ${migration.file}`);
      }
    })
  );
};
