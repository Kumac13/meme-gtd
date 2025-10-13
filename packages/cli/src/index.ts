#!/usr/bin/env node
import { run, flush } from '@oclif/core';

const argv = process.argv.slice(2);
if (argv[0] === '--') {
  argv.shift();
}

if (
  argv[0] === 'memo' &&
  argv[1] === 'comment' &&
  argv.slice(2).some((arg) => arg === '-h' || arg === '--help')
) {
  console.log(
    'Usage:\n' +
      '  mgtd memo comment <memoId> [--json]\n' +
      '  mgtd memo comment add <memoId> --body "comment"\n' +
      '  mgtd memo comment edit <memoId> <commentId> --body "new body"\n' +
      '  mgtd memo comment delete <memoId> <commentId> --yes'
  );
  console.log('\nSubcommands:');
  console.log('  add    add a new comment (--body / --body-file)');
  console.log('  edit   update an existing comment (--body / --body-file)');
  console.log('  delete remove a comment (--yes to skip confirmation)');
  console.log('\nTo list comments only, run `mgtd memo comment <memoId>`');
  process.exit(0);
}

const normalizedArgv = argv.map((arg) => (arg === '-h' ? '--help' : arg));

run(normalizedArgv, import.meta.url)
  .then(async () => {
    await flush();
  })
  .catch(async (error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(err);
    await flush();
    process.exitCode = 1;
  });
