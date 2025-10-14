import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export type SupportedShell = 'bash' | 'zsh' | 'fish';

const COMPLETION_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'assets',
  'completions'
);

export const shells: SupportedShell[] = ['bash', 'zsh', 'fish'];

export const readCompletionScript = (shell: SupportedShell): string => {
  const targetPath = resolveCompletionPath(shell);
  return readFileSync(targetPath, 'utf-8');
};

export const resolveCompletionPath = (shell: SupportedShell): string => {
  return path.join(COMPLETION_ROOT, `mgtd.${shell}`);
};
