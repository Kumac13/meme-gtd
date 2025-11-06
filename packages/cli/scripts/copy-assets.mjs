#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assets = {
  src: path.resolve(__dirname, '..', 'src', 'assets'),
  dest: path.resolve(__dirname, '..', 'dist', 'assets')
};

const templates = {
  src: path.resolve(__dirname, '..', 'templates'),
  dest: path.resolve(__dirname, '..', 'dist', 'templates')
};

const main = async () => {
  // Copy assets
  if (await fs.pathExists(assets.src)) {
    await fs.remove(assets.dest);
    await fs.copy(assets.src, assets.dest, { overwrite: true });
  }

  // Copy templates
  if (await fs.pathExists(templates.src)) {
    await fs.remove(templates.dest);
    await fs.copy(templates.src, templates.dest, { overwrite: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
