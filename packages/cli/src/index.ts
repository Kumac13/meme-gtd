#!/usr/bin/env node
import { run, flush, Errors } from '@oclif/core';

const MULTIWORD_COMMANDS = [
  ['memo', 'comment', 'add'],
  ['memo', 'comment', 'edit'],
  ['memo', 'comment', 'delete'],
  ['memo', 'comment'],
  ['memo', 'label', 'add'],
  ['memo', 'label', 'remove'],
  ['memo', 'label', 'set'],
  ['memo', 'label'],
  ['memo', 'create'],
  ['memo', 'delete'],
  ['memo', 'edit'],
  ['memo', 'list'],
  ['memo', 'promote'],
  ['memo', 'view'],
  ['memo']
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

run(collapsedArgv, import.meta.url)
  .then(async () => {
    await flush();
  })
  .catch(async (error: unknown) => {
    await flush();
    await Errors.handle(error instanceof Error ? error : new Error(String(error)));
  });
