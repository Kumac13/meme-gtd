import { Command, Help } from '@oclif/core';

export default class ProjectRoot extends Command {
  static summary = 'Manage projects and project items';
  static description =
    'Organize tasks and memos into projects with board or table views.\n\n' +
    'Available subcommands:\n' +
    '  - create: Create a new project\n' +
    '  - list: Show all projects\n' +
    '  - view: Show project details with items\n' +
    '  - add: Add an issue to a project\n' +
    '  - remove: Remove an issue from a project\n' +
    '  - move: Update item position or column\n' +
    '  - delete: Delete a project';

  static examples = [
    '$ mgtd project create "Sprint 1"',
    '$ mgtd project list',
    '$ mgtd project view 5',
    '$ mgtd project add 5 12',
    '$ mgtd project remove 5 12',
    '$ mgtd project delete 5'
  ];

  async run(): Promise<void> {
    const help = new Help(this.config);
    await help.showHelp(['project']);
  }
}
