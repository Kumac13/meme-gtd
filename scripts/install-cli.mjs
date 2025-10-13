#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(__filename, '..', '..');
const cliDir = path.join(repoRoot, 'packages', 'cli');

const build = spawnSync('pnpm', ['--filter', 'meme-gtd-cli', 'run', 'build'], {
  cwd: repoRoot,
  stdio: 'inherit'
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const binDir = process.env.MGTD_BIN_DIR || path.join(os.homedir(), '.local', 'bin');
ensureDir(binDir);

const source = path.join(cliDir, 'dist', 'index.js');
if (!fs.existsSync(source)) {
  console.error(`Build artifact not found: ${source}`);
  process.exit(1);
}

fs.chmodSync(source, 0o755);
const destination = path.join(binDir, 'mgtd');
if (fs.existsSync(destination)) {
  fs.rmSync(destination);
}

fs.symlinkSync(source, destination);
console.log(`mgtd installed at ${destination}`);

const pathEntries = (process.env.PATH || '').split(path.delimiter);
if (!pathEntries.includes(binDir)) {
  console.log(`NOTE: add ${binDir} to your PATH, e.g. export PATH=\"${binDir}:$PATH\"`);
}
