import { Command, Flags, Args } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ProjectService } from 'meme-gtd-core';

export default class ProjectMove extends Command {
  static summary = 'Move an item to a new position or column';
  static description =
    'Update the position and/or column of an item in a project. ' +
    'Position is a fractional number for flexible ordering.';
  static usage = ['<%= command.id %> <project-id> <issue-id> [--position <n>] [--column <name>] [--json]'];
  static examples = [
    '$ mgtd project move 5 12 --position 2.5',
    '$ mgtd project move 5 12 --column "Done"',
    '$ mgtd project move 5 12 --position 1.0 --column "To Do"',
    '$ mgtd project move 5 12 -p 3.0 -c "In Progress" -j'
  ];

  static args = {
    'project-id': Args.integer({
      description: 'Project ID',
      required: true
    }),
    'issue-id': Args.integer({
      description: 'Issue ID to move',
      required: true
    })
  };

  static flags = {
    position: Flags.string({
      char: 'p',
      summary: 'New position',
      description: 'Fractional position for ordering'
    }),
    column: Flags.string({
      char: 'c',
      summary: 'New column',
      description: 'Column name for board view'
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the updated project item as JSON',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ProjectMove);
    const projectId = args['project-id'];
    const issueId = args['issue-id'];
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new ProjectService({ config });

    // Validate at least one update is provided
    if (!flags.position && !flags.column) {
      this.error('At least one of --position or --column must be specified', { exit: 1 });
    }

    try {
      const position = flags.position ? parseFloat(flags.position) : undefined;

      const projectItem = service.updateItem(projectId, issueId, {
        position,
        column: flags.column ?? undefined
      });

      if (flags.json) {
        this.log(JSON.stringify(projectItem, null, 2));
        return;
      }

      // Human-readable output
      this.log(`Moved issue #${issueId} in project #${projectId}`);
      if (position !== undefined) {
        this.log(`New position: ${position}`);
      }
      if (flags.column) {
        this.log(`New column: ${flags.column}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }
  }
}
