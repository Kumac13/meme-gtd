import { Command, Help } from '@oclif/core';

export default class Search extends Command {
  static summary = 'Search commands';
  static description = 'Search across memos, tasks, and articles using keyword or semantic search.';

  async run(): Promise<void> {
    const help = new Help(this.config);
    await help.showHelp(['search']);
  }
}
