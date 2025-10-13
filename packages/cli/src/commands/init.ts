import fs from 'fs-extra';
import path from 'node:path';
import { Command, Flags } from '@oclif/core';
import { loadConfig, mergeConfigWithFlags, writeConfig } from 'meme-gtd-config';
import { applyMigrations } from 'meme-gtd-db';
import { createLogger } from 'meme-gtd-logger';

export default class Init extends Command {
  static description = 'Initialize the local mgtd database and configuration';

  static flags = {
    db: Flags.string({
      description: 'Path to the SQLite database file',
      required: false
    }),
    force: Flags.boolean({
      description: 'Overwrite existing database if present',
      default: false
    }),
    dryRun: Flags.boolean({
      description: 'Show what would happen without modifying files',
      default: false
    }),
    json: Flags.boolean({
      description: 'Output result as JSON',
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
      this.error(`Database already exists at ${dbPath}. Use --force to overwrite.`);
    }

    if (dbExists && flags.force) {
      await fs.remove(dbPath);
      logger.warn({ dbPath }, 'Removed existing database');
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
