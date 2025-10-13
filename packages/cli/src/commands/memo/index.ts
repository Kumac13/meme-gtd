import { Command } from '@oclif/core';

export default class MemoRoot extends Command {
  static summary = 'Memo commands entry point';
  static strict = false;

  async run(): Promise<void> {
    const [subcommand, ...rest] = this.argv;

    if (!subcommand) {
      await this.config.runCommand('memo:list', rest);
      return;
    }

    const commandId = `memo:${subcommand}`;
    if (this.config.commandIDs.includes(commandId)) {
      await this.config.runCommand(commandId, rest);
      return;
    }

    this.error(`Unknown memo subcommand: ${subcommand}`);
  }
}
