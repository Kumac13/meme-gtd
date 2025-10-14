#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.resolve(__dirname, '..', 'src', 'assets');
const dest = path.resolve(__dirname, '..', 'dist', 'assets');

const main = async () => {
  if (!(await fs.pathExists(src))) {
    return;
  }
  await fs.remove(dest);
  await fs.copy(src, dest, { overwrite: true });
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
