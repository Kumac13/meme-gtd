import { Command, Help } from '@oclif/core';

export default class MemoRoot extends Command {
  static summary = 'Captured memo workspace';
  static description =
    'Browse, capture, and curate memo items before they are promoted into actionable tasks.';

  async run(): Promise<void> {
    const help = new Help(this.config);
    await help.showHelp(['memo']);
  }
}
