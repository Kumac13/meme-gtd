#!/usr/bin/env node
import { run, flush } from '@oclif/core';

const normalizedArgv = process.argv
  .slice(2)
  .flatMap((arg) => (arg === '-h' ? ['--help'] : arg));

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
