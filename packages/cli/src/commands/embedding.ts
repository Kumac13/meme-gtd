import { Command, Help } from '@oclif/core';

export default class Embedding extends Command {
  static summary = 'Embedding management commands';
  static description = 'Manage vector embeddings for semantic search.';

  async run(): Promise<void> {
    const help = new Help(this.config);
    await help.showHelp(['embedding']);
  }
}
