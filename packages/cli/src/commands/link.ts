import { Command, Help } from '@oclif/core';

export default class LinkRoot extends Command {
  static summary = 'Manage links between tasks and memos';
  static description =
    'Create and manage relationships between tasks and memos. Supports four link types:\n' +
    '  - parent: Parent-child task hierarchy\n' +
    '  - child: Reverse of parent\n' +
    '  - relates: General association between items\n' +
    '  - derived_from: Tasks derived from memos\n\n' +
    'Available subcommands:\n' +
    '  - add: Create a new link between two issues\n' +
    '  - list: Show all links for a specific issue';

  static examples = [
    '$ mgtd link add --type parent --source 5 --target 10',
    '$ mgtd link list 5',
    '$ mgtd link list 10 --type parent'
  ];

  async run(): Promise<void> {
    const help = new Help(this.config);
    await help.showHelp(['link']);
  }
}
