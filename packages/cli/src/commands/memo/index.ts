import { Command } from '@oclif/core';

export default class MemoRoot extends Command {
  static summary = 'Memo commands entry point';
  static strict = false;

  async run(): Promise<void> {
    const [subcommand, ...rest] = this.argv;

    if (!subcommand || subcommand === '-h' || subcommand === '--help') {
      const args = subcommand ? ['--help', ...rest] : rest;
      await this.config.runCommand('memo:list', args);
      return;
    }

    if (subcommand === 'comment') {
      const [action, ...next] = rest;

      if (action === '-h' || action === '--help') {
        this.log(
          'memo comment コマンドの使い方:\n' +
            '  mgtd memo comment <memoId> [--json]\n' +
            '  mgtd memo comment add <memoId> --body "comment"\n' +
            '  mgtd memo comment edit <memoId> <commentId> --body "new body"\n' +
            '  mgtd memo comment delete <memoId> <commentId> --yes'
        );
        this.log('\nサブコマンド例:');
        this.log('  add    コメントを追加 (--body / --body-file)');
        this.log('  edit   コメントを編集 (--body / --body-file)');
        this.log('  delete コメントを削除 (--yes で確認省略)');
        this.log('\nコメント一覧のみ表示する場合は `mgtd memo comment <memoId>` を実行してください。');
        return;
      }

      const nested = action ? `memo:comment:${action}` : undefined;
      if (nested && this.config.commandIDs.includes(nested)) {
        await this.config.runCommand(nested, next);
        return;
      }

      const addFlags = new Set(['--body', '--body-file']);
      const isNumericId = action && /^\d+$/.test(action);
      const hasAddFlags = next.some((arg) => addFlags.has(arg));

      if (isNumericId && hasAddFlags) {
        await this.config.runCommand('memo:comment:add', [action, ...next]);
        return;
      }

      if (
        rest.some((arg) => arg.startsWith('--') && arg !== '--json') &&
        !(isNumericId && !next.length)
      ) {
        this.log(
          'Usage: mgtd memo comment <memoId> [--json] もしくは mgtd memo comment <add|edit|delete> ...\n' +
            '例: mgtd memo comment add 1 --body "comment"'
        );
        await this.config.runCommand('memo:comment', ['--help']);
        this.exit(2);
        return;
      }

      await this.config.runCommand('memo:comment', rest);
      return;
    }

    const directCommandId = `memo:${subcommand}`;
    if (this.config.commandIDs.includes(directCommandId)) {
      await this.config.runCommand(directCommandId, rest);
      return;
    }

    this.error(`Unknown memo subcommand: ${subcommand}`);
  }
}
