import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'node:path';

export interface BackupOptions {
  /** Destination directory. Defaults to `<db dir>/backups`. */
  readonly backupDir?: string;
  /** Number of backups to keep (older ones are pruned). 0 disables pruning. Defaults to 7. */
  readonly keep?: number;
}

export interface BackupResult {
  readonly backupPath: string;
  readonly sizeBytes: number;
  readonly prunedFiles: string[];
}

export interface BackupInfo {
  readonly path: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;
}

const DEFAULT_KEEP = 7;

// Matches `<basename>-YYYYMMDD-HHmmssSSS.db` produced by createBackup; prune
// only ever touches files with this shape to avoid deleting anything else
const BACKUP_FILE_PATTERN = /-\d{8}-\d{9}\.db$/;

const timestamp = (date: Date): string => {
  const pad = (value: number, length = 2): string => String(value).padStart(length, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${pad(date.getMilliseconds(), 3)}`
  );
};

export const defaultBackupDir = (dbPath: string): string =>
  path.join(path.dirname(path.resolve(dbPath)), 'backups');

/**
 * Create a consistent snapshot of the SQLite database using the online
 * backup API. Safe with WAL mode: uncheckpointed WAL content is included.
 * The source is opened read-only with fileMustExist so a wrong path can
 * never create an empty database.
 */
export const createBackup = async (
  dbPath: string,
  options: BackupOptions = {}
): Promise<BackupResult> => {
  const resolvedDbPath = path.resolve(dbPath);
  const backupDir = path.resolve(options.backupDir ?? defaultBackupDir(resolvedDbPath));
  const keep = options.keep ?? DEFAULT_KEEP;

  const db = new Database(resolvedDbPath, { readonly: true, fileMustExist: true });
  try {
    await fs.ensureDir(backupDir);
    const basename = path.basename(resolvedDbPath, path.extname(resolvedDbPath));
    const backupPath = path.join(backupDir, `${basename}-${timestamp(new Date())}.db`);
    await db.backup(backupPath);
    const { size } = await fs.stat(backupPath);
    const prunedFiles = keep > 0 ? await pruneBackups(backupDir, keep) : [];
    return { backupPath, sizeBytes: size, prunedFiles };
  } finally {
    db.close();
  }
};

export const listBackups = async (backupDir: string): Promise<BackupInfo[]> => {
  const resolved = path.resolve(backupDir);
  if (!(await fs.pathExists(resolved))) {
    return [];
  }
  const entries = await fs.readdir(resolved);
  const backups: BackupInfo[] = [];
  for (const entry of entries) {
    if (!BACKUP_FILE_PATTERN.test(entry)) {
      continue;
    }
    const filePath = path.join(resolved, entry);
    const stats = await fs.stat(filePath);
    backups.push({ path: filePath, sizeBytes: stats.size, createdAt: stats.mtime });
  }
  // Newest first; filenames embed a millisecond timestamp, so they break
  // ties when mtimes are equal
  return backups.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.path.localeCompare(a.path)
  );
};

export const pruneBackups = async (backupDir: string, keep: number): Promise<string[]> => {
  const backups = await listBackups(backupDir);
  const expired = backups.slice(keep);
  const pruned: string[] = [];
  for (const backup of expired) {
    await fs.remove(backup.path);
    pruned.push(backup.path);
  }
  return pruned;
};

export const latestBackupTime = async (backupDir: string): Promise<Date | null> => {
  const backups = await listBackups(backupDir);
  return backups.length > 0 ? backups[0].createdAt : null;
};
