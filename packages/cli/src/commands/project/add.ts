import { Command, Flags, Args } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ProjectService } from 'meme-gtd-core';

export default class ProjectAdd extends Command {
  static summary = 'Add an issue to a project';
  static description =
    'Add a task or memo to a project. Optionally specify position and column for board views.';
  static usage = ['<%= command.id %> <project-id> <issue-id> [--position <n>] [--column <name>] [--json]'];
  static examples = [
    '$ mgtd project add 5 12',
    '$ mgtd project add 5 12 --position 1.5',
    '$ mgtd project add 5 12 --column "In Progress"',
    '$ mgtd project add 5 12 --position 2.0 --column "Done" --json'
  ];

  static args = {
    'project-id': Args.integer({
      description: 'Project ID',
      required: true
    }),
    'issue-id': Args.integer({
      description: 'Issue ID (task or memo)',
      required: true
    })
  };

  static flags = {
    position: Flags.string({
      char: 'p',
      summary: 'Position in project',
      description: 'Fractional position for ordering (defaults to end)'
    }),
    column: Flags.string({
      char: 'c',
      summary: 'Board column name',
      description: 'Column name for board view (e.g., "To Do", "In Progress", "Done")'
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the created project item as JSON',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ProjectAdd);
    const projectId = args['project-id'];
    const issueId = args['issue-id'];
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new ProjectService({ config });

    try {
      const position = flags.position ? parseFloat(flags.position) : undefined;

      const projectItem = service.addItem(projectId, {
        issueId,
        position,
        column: flags.column ?? null
      });

      if (flags.json) {
        this.log(JSON.stringify(projectItem, null, 2));
        return;
      }

      // Human-readable output
      this.log(`Added issue #${issueId} to project #${projectId}`);
      if (position !== undefined) {
        this.log(`Position: ${position}`);
      }
      if (flags.column) {
        this.log(`Column: ${flags.column}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }
  }
}
