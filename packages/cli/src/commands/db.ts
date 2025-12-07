import { Command, Help } from '@oclif/core';

export default class Db extends Command {
  static summary = 'Database management commands';
  static description = 'Manage mgtd database: run migrations, backup, etc.';

  async run(): Promise<void> {
    const help = new Help(this.config);
    await help.showHelp(['db']);
  }
}
