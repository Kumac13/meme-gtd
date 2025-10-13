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
          'Usage:\n' +
            '  mgtd memo comment <memoId> [--json]\n' +
            '  mgtd memo comment add <memoId> --body "comment"\n' +
            '  mgtd memo comment edit <memoId> <commentId> --body "new body"\n' +
            '  mgtd memo comment delete <memoId> <commentId> --yes'
        );
        this.log('\nSubcommands:');
        this.log('  add    add a new comment (--body / --body-file)');
        this.log('  edit   update an existing comment (--body / --body-file)');
        this.log('  delete remove a comment (--yes to skip confirmation)');
        this.log('\nTo list comments only, run `mgtd memo comment <memoId>`');
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
          'Usage: mgtd memo comment <memoId> [--json] or mgtd memo comment <add|edit|delete> ...\n' +
            'Example: mgtd memo comment add 1 --body "comment"'
        );
        await this.config.runCommand('memo:comment', ['--help']);
        process.exitCode = 2;
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
