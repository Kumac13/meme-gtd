import { Command, Help } from '@oclif/core';

export default class TaskRoot extends Command {
  static summary = 'Task management';
  static description =
    'Create, list, and manage actionable tasks with status tracking (open/next/waiting/scheduled/done/canceled).';

  async run(): Promise<void> {
    const help = new Help(this.config);
    await help.showHelp(['task']);
  }
}
