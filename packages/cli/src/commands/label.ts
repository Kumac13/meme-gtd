import { Command, Help } from '@oclif/core';

export default class LabelRoot extends Command {
  static summary = 'Unified label management';
  static description =
    'Manage labels that can be assigned to both memos and tasks. Use subcommands to list, add, set, or delete labels.';

  async run(): Promise<void> {
    const help = new Help(this.config);
    await help.showHelp(['label']);
  }
}
