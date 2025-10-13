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
        await this.config.runCommand('memo:comment', ['--help']);
        return;
      }

      const nested = action ? `memo:comment:${action}` : undefined;
      if (nested && this.config.commandIDs.includes(nested)) {
        await this.config.runCommand(nested, next);
        return;
      }

      const forbiddenFlags = rest.filter((arg) => arg.startsWith('--') && arg !== '--json');
      if (forbiddenFlags.length > 0) {
        this.error(
          'Usage: mgtd memo comment <memoId> [--json] もしくは mgtd memo comment <add|edit|delete> ...\n' +
            '例: mgtd memo comment add 1 --body "comment"',
          { exit: 2 }
        );
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
