import { Command, Help } from '@oclif/core';

export default class ClaudeRoot extends Command {
  static summary = 'Manage Claude Code slash commands';
  static description =
    'Install, update, list, and remove meme-gtd slash commands for Claude Code.';

  async run(): Promise<void> {
    const help = new Help(this.config);
    await help.showHelp(['claude']);
  }
}
