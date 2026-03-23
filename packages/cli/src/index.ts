#!/usr/bin/env node
import { run, flush, Errors } from '@oclif/core';
import fsExtra from 'fs-extra';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Load .env from ~/.config/mgtd/.env (Node.js 22 native)
// Shell environment variables take precedence over .env values
try {
  process.loadEnvFile(join(homedir(), '.config', 'mgtd', '.env'));
} catch {
  // .env file is optional
}

const { readJsonSync } = fsExtra;

const MULTIWORD_COMMANDS = [
  ['memo', 'comment', 'add'],
  ['memo', 'comment', 'edit'],
  ['memo', 'comment', 'delete'],
  ['memo', 'comment'],
  ['memo', 'bookmark'],
  ['memo', 'unbookmark'],
  ['memo', 'create'],
  ['memo', 'delete'],
  ['memo', 'edit'],
  ['memo', 'list'],
  ['memo', 'promote'],
  ['memo', 'view'],
  ['memo'],
  ['task', 'comment', 'add'],
  ['task', 'comment', 'edit'],
  ['task', 'comment', 'delete'],
  ['task', 'comment'],
  ['task', 'bookmark'],
  ['task', 'unbookmark'],
  ['task', 'create'],
  ['task', 'delete'],
  ['task', 'edit'],
  ['task', 'list'],
  ['task', 'view'],
  ['task', 'close'],
  ['task', 'cancel'],
  ['task', 'reopen'],
  ['task', 'demote'],
  ['task'],
  ['label', 'create'],
  ['label', 'set'],
  ['label', 'delete'],
  ['label', 'list'],
  ['label'],
  ['project', 'create'],
  ['project', 'list'],
  ['project', 'view'],
  ['project', 'update'],
  ['project', 'add'],
  ['project', 'remove'],
  ['project', 'move'],
  ['project', 'delete'],
  ['project'],
  ['search', 'keyword'],
  ['search', 'semantic'],
  ['search'],
  ['embedding', 'sync'],
  ['embedding'],
  ['db', 'migrate'],
  ['db']
] as const;

const argv = process.argv.slice(2);
const withoutSeparator = argv[0] === '--' ? argv.slice(1) : argv;
const normalizedHelpArgv = withoutSeparator.map((arg) => (arg === '-h' ? '--help' : arg));

const collapsedArgv = (() => {
  if (normalizedHelpArgv.length === 0) {
    return normalizedHelpArgv;
  }
  if (normalizedHelpArgv[0]?.includes(':')) {
    return normalizedHelpArgv;
  }

  const lower = normalizedHelpArgv.map((token) => token.toLowerCase());
  let bestMatch: { length: number; id: string } | undefined;

  for (const segments of MULTIWORD_COMMANDS) {
    if (segments.length > lower.length) {
      continue;
    }

    const slice = lower.slice(0, segments.length);
    const matches = slice.every((value, index) => value === segments[index]);
    if (!matches) {
      continue;
    }

    const id = segments.join(':');
    if (!bestMatch || segments.length > bestMatch.length) {
      bestMatch = { length: segments.length, id };
    }
  }

  if (!bestMatch) {
    return normalizedHelpArgv;
  }

  return [bestMatch.id, ...normalizedHelpArgv.slice(bestMatch.length)];
})();

// Handle version flag before oclif routing
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, '../package.json');
    const pkg = readJsonSync(pkgPath);
    console.log(pkg.version);
    process.exit(0);
  } catch (error) {
    console.error('Error: Could not read package.json');
    process.exit(1);
  }
}

run(collapsedArgv, import.meta.url)
  .then(async () => {
    await flush();
  })
  .catch(async (error: unknown) => {
    await flush();
    await Errors.handle(error instanceof Error ? error : new Error(String(error)));
  });
