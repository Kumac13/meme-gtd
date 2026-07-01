import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface MigrationResult {
  applied: string[];
  skipped: string[];
}

const schemaDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  './schema'
);

const migrations = [
  { version: '001_init', file: path.join(schemaDir, '001_init.sql') },
  { version: '002_add_project_view_meta', file: path.join(schemaDir, '002_add_project_view_meta.sql') },
  { version: '003_add_fts5', file: path.join(schemaDir, '003_add_fts5.sql') },
  { version: '004_add_task_time_fields', file: path.join(schemaDir, '004_add_task_time_fields.sql') },
  { version: '005_add_task_end_date', file: path.join(schemaDir, '005_add_task_end_date.sql') },
  { version: '006_add_project_status_and_schedule', file: path.join(schemaDir, '006_add_project_status_and_schedule.sql') },
  { version: '007_add_calendar_datetime_fields', file: path.join(schemaDir, '007_add_calendar_datetime_fields.sql') },
  { version: '008_add_activity_log', file: path.join(schemaDir, '008_add_activity_log.sql') },
  { version: '009_activity_log_immutability', file: path.join(schemaDir, '009_activity_log_immutability.sql') },
  { version: '010_update_issues_type_check', file: path.join(schemaDir, '010_update_issues_type_check.sql') },
  { version: '011_add_url_links', file: path.join(schemaDir, '011_add_url_links.sql') },
  { version: '012_add_task_kind', file: path.join(schemaDir, '012_add_task_kind.sql') },
  { version: '013_add_embeddings', file: path.join(schemaDir, '013_add_embeddings.sql') },
  { version: '014_restore_calendar_indexes', file: path.join(schemaDir, '014_restore_calendar_indexes.sql') }
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
    try {
      db.exec(sql);
    } catch (error: any) {
      // If the error is "duplicate column name", it means the column already exists.
      // This can happen if the migration failed halfway or was manually applied.
      // We can safely ignore this error and mark the migration as applied.
      if (error.code === 'SQLITE_ERROR' && error.message.includes('duplicate column name')) {
        // console.warn(`Migration ${migration.version} warning: Column already exists, skipping execution but marking as applied.`);
      } else {
        throw error;
      }
    }

    db.prepare('INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)').run(migration.version);
    result.applied.push(migration.version);
  }

  db.close();
  return result;
};
