import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_EDITOR = process.env.EDITOR ?? 'vi';

export interface EditorOptions {
  editor?: boolean;       // --editor フラグ
  noEditor?: boolean;     // --no-editor フラグ
  initialContent?: string;
}

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

/**
 * エディタ起動の制御を行うヘルパー関数
 * 優先順位: --no-editor > --editor > デフォルト動作
 */
export async function maybePromptEditor(options: EditorOptions): Promise<string | undefined> {
  // 相互排他チェック
  if (options.editor && options.noEditor) {
    throw new Error('Cannot specify both --editor and --no-editor');
  }

  // --no-editor: エディタを起動しない
  if (options.noEditor) {
    return undefined;
  }

  // --editor: 強制起動
  if (options.editor) {
    return await promptEditor(options.initialContent);
  }

  // デフォルト: 初期コンテンツがなければ起動
  if (!options.initialContent) {
    return await promptEditor();
  }

  return undefined;
}
