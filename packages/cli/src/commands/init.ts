import fs from 'fs-extra';
import path from 'node:path';
import { Command, Flags } from '@oclif/core';
import { loadConfig, mergeConfigWithFlags, writeConfig } from 'meme-gtd-config';
import { applyMigrations } from 'meme-gtd-db';
import { createLogger } from 'meme-gtd-logger';
import { confirmDestructive } from '../lib/confirm.js';

export default class Init extends Command {
  static summary = 'Bootstrap local mgtd storage';
  static description = 'Initialize the local mgtd database and configuration';
  static usage = ['<%= command.id %> [--db <path>] [--force] [--yes] [--dry-run] [--json]'];
  static examples = [
    '$ mgtd init',
    '$ mgtd init --db ~/.local/share/mgtd/issues.db',
    '$ mgtd init --force --yes --json'
  ];

  static flags = {
    db: Flags.string({
      char: 'd',
      summary: 'SQLite database file path',
      description:
        'Override the configured SQLite database location. Defaults to the path stored in mgtd config.',
      required: false
    }),
    force: Flags.boolean({
      char: 'f',
      summary: 'Overwrite any existing database',
      description: 'Remove the current database before re-creating it from migrations.',
      default: false
    }),
    yes: Flags.boolean({
      char: 'y',
      summary: 'Skip the confirmation prompt when overwriting an existing database',
      description:
        'Required to overwrite an existing database in non-interactive mode (scripts, CI). ' +
        'In interactive mode it skips the confirmation prompt.',
      default: false
    }),
    dryRun: Flags.boolean({
      char: 'n',
      summary: 'Preview actions without writing files',
      description:
        'Emit a summary of configuration and migration changes instead of touching the filesystem.',
      default: false
    }),
    json: Flags.boolean({
      char: 'j',
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
      if (!flags.yes) {
        const stats = await fs.stat(dbPath);
        const confirmed = await confirmDestructive(
          `This will PERMANENTLY DELETE the existing database:\n` +
            `  path: ${dbPath}\n` +
            `  size: ${stats.size} bytes`
        );
        if (!confirmed) {
          const message = process.stdin.isTTY
            ? 'Aborted. Existing database was not modified.'
            : 'Refusing to overwrite existing database in non-interactive mode. Pass --yes to confirm.';
          if (flags.json) {
            this.log(JSON.stringify({ error: message, dbPath }, null, 2));
          } else {
            this.log(message);
          }
          process.exitCode = 1;
          return;
        }
      }
      await fs.remove(dbPath);
      if (!flags.json) {
        logger.warn({ dbPath }, 'Removed existing database');
      }
    }

    const { applied, skipped } = applyMigrations(dbPath);
    await writeConfig(mergedConfig, configPath);

    // Generate .env template if it does not exist
    const envDir = path.dirname(configPath);
    const envPath = path.join(envDir, '.env');
    if (!await fs.pathExists(envPath)) {
      const envTemplate = [
        '# mgtd embedding configuration',
        '# OpenAI-compatible embeddings endpoint',
        'MGTD_EMBEDDING_URL=http://localhost:11434/v1',
        'MGTD_EMBEDDING_MODEL=qwen3-embedding:4b',
        'MGTD_EMBEDDING_API_KEY=ollama',
        '',
        '# Query prefix (model-specific, prepended to search queries before embedding)',
        '# qwen3-embedding:',
        'MGTD_EMBEDDING_QUERY_PREFIX="Instruct: Given a search query, retrieve relevant documents\\nQuery: "',
        '# nomic-embed-text: MGTD_EMBEDDING_QUERY_PREFIX=search_query: ',
        '# bge-m3 or models without prefix: leave empty or unset',
        '',
        '# For OpenAI:',
        '# MGTD_EMBEDDING_URL=https://api.openai.com/v1',
        '# MGTD_EMBEDDING_MODEL=text-embedding-3-small',
        '# MGTD_EMBEDDING_API_KEY=sk-xxxxx',
        '',
      ].join('\n');
      await fs.writeFile(envPath, envTemplate, 'utf-8');
    }

    const payload = {
      configPath,
      dbPath,
      envPath,
      appliedMigrations: applied,
      skippedMigrations: skipped
    };

    if (flags.json) {
      this.log(JSON.stringify(payload, null, 2));
    } else {
      this.log(`Configuration written to ${configPath}`);
      this.log(`Database ready at ${dbPath}`);
      this.log(`Environment file at ${envPath}`);
      if (applied.length) {
        this.log(`Applied migrations: ${applied.join(', ')}`);
      }
      if (skipped.length) {
        this.log(`Skipped migrations: ${skipped.join(', ')}`);
      }
    }
  }
}
