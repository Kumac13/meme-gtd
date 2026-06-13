import fs from 'fs-extra';
import path from 'node:path';
import { Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { applyMigrations, createBackup } from 'meme-gtd-db';

export default class DbMigrate extends Command {
  static summary = 'Apply database migrations safely';
  static description = `Apply pending migrations to an existing database.
This command will:
1. Create a backup of the database (unless --no-backup)
2. Check current migration status
3. Apply any pending migrations
4. Report results

Unlike 'mgtd init --force', this command will NOT delete your database.`;

  static usage = ['<%= command.id %> [--db <path>] [--no-backup] [--dry-run] [--json]'];
  static examples = [
    '$ mgtd db migrate',
    '$ mgtd db migrate --dry-run',
    '$ mgtd db migrate --db ~/.local/share/mgtd/issues.db',
    '$ mgtd db migrate --no-backup --json'
  ];

  static flags = {
    db: Flags.string({
      char: 'd',
      summary: 'SQLite database file path',
      description: 'Override the configured SQLite database location.',
      required: false
    }),
    backup: Flags.boolean({
      summary: 'Create backup before migration',
      description: 'Create a timestamped backup of the database before applying migrations.',
      default: true,
      allowNo: true
    }),
'dry-run': Flags.boolean({
      char: 'n',
      summary: 'Preview migrations without applying',
      description: 'Show which migrations would be applied without actually running them.',
      default: false
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return structured JSON output',
      description: 'Useful for scripting: returns migration details as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(DbMigrate);

    const { config: currentConfig } = await loadConfig({ createIfMissing: false });
    const dbPath = path.resolve(flags.db ?? currentConfig.dbPath);

    // Check if database exists
    const dbExists = await fs.pathExists(dbPath);
    if (!dbExists) {
      const message = `Database not found at ${dbPath}. Use 'mgtd init' to create a new database.`;
      if (flags.json) {
        this.log(JSON.stringify({ error: message, dbPath }, null, 2));
      } else {
        this.error(message);
      }
      return;
    }

    // Get current database size for reporting
    const stats = await fs.stat(dbPath);
    const dbSizeKB = Math.round(stats.size / 1024);

    if (flags['dry-run']) {
      // For dry run, we need to check migration status without applying
      const summary = {
        dryRun: true,
        dbPath,
        dbSizeKB,
        wouldBackup: flags.backup,
        message: 'Use without --dry-run to apply migrations'
      };
      if (flags.json) {
        this.log(JSON.stringify(summary, null, 2));
      } else {
        this.log('Dry run summary:');
        this.log(`  Database: ${dbPath} (${dbSizeKB} KB)`);
        this.log(`  Would create backup: ${flags.backup ? 'yes' : 'no'}`);
        this.log('  Remove --dry-run to apply migrations.');
      }
      return;
    }

    // Create backup if requested. Uses the SQLite online backup API instead
    // of a file copy: a plain copy misses uncheckpointed WAL content.
    let backupPath: string | null = null;
    if (flags.backup) {
      const result = await createBackup(dbPath, { keep: 0 });
      backupPath = result.backupPath;

      if (!flags.json) {
        this.log(`Backup created: ${backupPath}`);
      }
    }

    // Apply migrations
    try {
      const { applied, skipped } = applyMigrations(dbPath);

      const result = {
        success: true,
        dbPath,
        dbSizeKB,
        backupPath,
        appliedMigrations: applied,
        skippedMigrations: skipped
      };

      if (flags.json) {
        this.log(JSON.stringify(result, null, 2));
      } else {
        if (applied.length > 0) {
          this.log(`Applied migrations: ${applied.join(', ')}`);
        } else {
          this.log('No new migrations to apply. Database is up to date.');
        }
        if (skipped.length > 0) {
          this.log(`Already applied: ${skipped.join(', ')}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (flags.json) {
        this.log(JSON.stringify({
          success: false,
          error: errorMessage,
          dbPath,
          backupPath,
          hint: backupPath ? `Restore from backup: cp "${backupPath}" "${dbPath}"` : null
        }, null, 2));
      } else {
        this.error(`Migration failed: ${errorMessage}`);
        if (backupPath) {
          this.log(`Restore from backup: cp "${backupPath}" "${dbPath}"`);
        }
      }
    }
  }
}
