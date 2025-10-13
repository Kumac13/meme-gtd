import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_EDITOR = process.env.EDITOR ?? 'vi';

export const promptEditor = async (initialContent = ''): Promise<string> => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'mgtd-'));
  const filePath = path.join(tempDir, 'memo.md');
  await writeFile(filePath, initialContent, 'utf-8');

  await new Promise<void>((resolve, reject) => {
    const editor = spawn(DEFAULT_EDITOR, [filePath], {
      stdio: 'inherit'
    });

    editor.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${DEFAULT_EDITOR} exited with code ${code}`));
      }
    });

    editor.on('error', (err) => reject(err));
  });

  const content = await readFile(filePath, 'utf-8');
  return content.trim();
};
