import { Command, Help } from '@oclif/core';

export default class LinkRoot extends Command {
  static summary = 'Manage links between tasks and memos';
  static description =
    'Create and manage relationships between tasks and memos. Use subcommands to add, list, or remove links.';

  async run(): Promise<void> {
    const help = new Help(this.config);
    await help.showHelp(['link']);
  }
}
