import fs from 'fs-extra';
import path from 'node:path';

export const loadBodyFromFile = async (filePath: string): Promise<string> => {
  const target = filePath === '-' ? '/dev/stdin' : path.resolve(filePath);
  const exists = await fs.pathExists(target);
  if (!exists && filePath !== '-') {
    throw new Error(`File not found: ${target}`);
  }
  const buffer = await fs.readFile(target, 'utf-8');
  return buffer.toString();
};
