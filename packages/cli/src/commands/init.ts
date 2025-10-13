import fs from 'fs-extra';
import path from 'node:path';
import { Command, Flags } from '@oclif/core';
import { loadConfig, mergeConfigWithFlags, writeConfig } from 'meme-gtd-config';
import { applyMigrations } from 'meme-gtd-db';
import { createLogger } from 'meme-gtd-logger';

export default class Init extends Command {
  static summary = 'Bootstrap local mgtd storage';
  static description = 'Initialize the local mgtd database and configuration';
  static usage = ['<%= command.id %> [--db <path>] [--force] [--dry-run] [--json]'];
  static examples = [
    '$ mgtd init',
    '$ mgtd init --db ~/.local/share/mgtd/issues.db',
    '$ mgtd init --force --json'
  ];

  static flags = {
    db: Flags.string({
      summary: 'SQLite database file path',
      description:
        'Override the configured SQLite database location. Defaults to the path stored in mgtd config.',
      required: false
    }),
    force: Flags.boolean({
      summary: 'Overwrite any existing database',
      description: 'Remove the current database before re-creating it from migrations.',
      default: false
    }),
    dryRun: Flags.boolean({
      summary: 'Preview actions without writing files',
      description:
        'Emit a summary of configuration and migration changes instead of touching the filesystem.',
      default: false
    }),
    json: Flags.boolean({
      summary: 'Return structured JSON output',
      description: 'Useful for scripting: returns config and migration details as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const logger = createLogger();

    const { config: currentConfig, path: configPath } = await loadConfig({ createIfMissing: false });

    const mergedConfig = mergeConfigWithFlags(currentConfig, {
      dbPath: flags.db ?? currentConfig.dbPath,
      mode: 'local'
    });

    const dbPath = path.resolve(mergedConfig.dbPath);
    const dbExists = await fs.pathExists(dbPath);

    if (flags.dryRun) {
      const summary = {
        configPath,
        dbPath,
        willCreateConfig: !(await fs.pathExists(configPath)),
        willCreateDb: !dbExists,
        willOverwriteDb: dbExists && flags.force
      };
      if (flags.json) {
        this.log(JSON.stringify({ dryRun: summary }, null, 2));
      } else {
        this.log('Dry run summary:');
        this.log(JSON.stringify(summary, null, 2));
      }
      return;
    }

    if (dbExists && !flags.force) {
      const message =
        `Database already exists at ${dbPath}.\n` +
        'Use `mgtd init --force` to overwrite, or specify a different path with `--db`.';
      if (flags.json) {
        this.log(
          JSON.stringify({ error: message, dbPath, hint: 'Use --force or --db to proceed' }, null, 2)
        );
      } else {
        this.log(message);
      }
      process.exitCode = 1;
      return;
    }

    if (dbExists && flags.force) {
      await fs.remove(dbPath);
      if (!flags.json) {
        logger.warn({ dbPath }, 'Removed existing database');
      }
    }

    const { applied, skipped } = applyMigrations(dbPath);
    await writeConfig(mergedConfig, configPath);

    const payload = {
      configPath,
      dbPath,
      appliedMigrations: applied,
      skippedMigrations: skipped
    };

    if (flags.json) {
      this.log(JSON.stringify(payload, null, 2));
    } else {
      this.log(`Configuration written to ${configPath}`);
      this.log(`Database ready at ${dbPath}`);
      if (applied.length) {
        this.log(`Applied migrations: ${applied.join(', ')}`);
      }
      if (skipped.length) {
        this.log(`Skipped migrations: ${skipped.join(', ')}`);
      }
    }
  }
}
