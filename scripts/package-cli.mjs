#!/usr/bin/env node
import { spawn } from 'node:child_process';

const run = (cmd, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
      } else {
        resolve(undefined);
      }
    });
  });

const main = async () => {
  await run('pnpm', ['build']);
  await run('pnpm', ['--dir', 'packages/cli', 'pack']);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
