import fs from 'fs-extra';
import path from 'node:path';
import { Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { createBackup, listBackups, defaultBackupDir } from 'meme-gtd-db';

export default class DbBackup extends Command {
  static summary = 'Create a consistent backup of the database';
  static description = `Create a timestamped snapshot of the SQLite database using the online
backup API. Safe to run while the API server or CLI is using the database
(WAL mode): uncheckpointed writes are included in the snapshot.

Backups are stored as <name>-YYYYMMDD-HHmmssSSS.db and older generations
beyond --keep are pruned automatically.`;

  static usage = ['<%= command.id %> [--db <path>] [--output <dir>] [--keep <n>] [--list] [--json]'];
  static examples = [
    '$ mgtd db backup',
    '$ mgtd db backup --keep 14',
    '$ mgtd db backup --output ~/backups/mgtd',
    '$ mgtd db backup --list',
    '$ mgtd db backup --json'
  ];

  static flags = {
    db: Flags.string({
      char: 'd',
      summary: 'SQLite database file path',
      description: 'Override the configured SQLite database location.',
      required: false
    }),
    output: Flags.string({
      char: 'o',
      summary: 'Backup destination directory',
      description: 'Directory to store backups. Defaults to a "backups" directory next to the database file.',
      required: false
    }),
    keep: Flags.integer({
      summary: 'Number of backup generations to keep',
      description: 'Older backups beyond this count are deleted after a successful backup. Use 0 to disable pruning.',
      default: 7
    }),
    list: Flags.boolean({
      char: 'l',
      summary: 'List existing backups instead of creating one',
      description: 'Show existing backups in the destination directory, newest first.',
      default: false
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return structured JSON output',
      description: 'Useful for scripting: returns backup details as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(DbBackup);

    const { config: currentConfig } = await loadConfig({ createIfMissing: false });
    const dbPath = path.resolve(flags.db ?? currentConfig.dbPath);
    const backupDir = path.resolve(flags.output ?? defaultBackupDir(dbPath));

    if (flags.list) {
      const backups = await listBackups(backupDir);
      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              backupDir,
              backups: backups.map((backup) => ({
                path: backup.path,
                sizeBytes: backup.sizeBytes,
                createdAt: backup.createdAt.toISOString()
              }))
            },
            null,
            2
          )
        );
        return;
      }
      if (backups.length === 0) {
        this.log(`No backups found in ${backupDir}`);
        return;
      }
      this.log(`Backups in ${backupDir}:`);
      for (const backup of backups) {
        const sizeKB = Math.round(backup.sizeBytes / 1024);
        this.log(`  ${path.basename(backup.path)}  ${sizeKB} KB  ${backup.createdAt.toISOString()}`);
      }
      return;
    }

    if (!(await fs.pathExists(dbPath))) {
      const message = `Database not found at ${dbPath}. Use 'mgtd init' to create a new database.`;
      if (flags.json) {
        this.log(JSON.stringify({ error: message, dbPath }, null, 2));
        process.exitCode = 1;
        return;
      }
      this.error(message);
    }

    try {
      const result = await createBackup(dbPath, { backupDir, keep: flags.keep });
      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              success: true,
              dbPath,
              backupPath: result.backupPath,
              sizeBytes: result.sizeBytes,
              prunedFiles: result.prunedFiles
            },
            null,
            2
          )
        );
        return;
      }
      const sizeKB = Math.round(result.sizeBytes / 1024);
      this.log(`Backup created: ${result.backupPath} (${sizeKB} KB)`);
      if (result.prunedFiles.length > 0) {
        this.log(`Pruned ${result.prunedFiles.length} old backup(s)`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: errorMessage, dbPath }, null, 2));
        process.exitCode = 1;
        return;
      }
      this.error(`Backup failed: ${errorMessage}`);
    }
  }
}
