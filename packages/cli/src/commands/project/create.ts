import { Command, Flags, Args } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ProjectService } from 'meme-gtd-core';
import type { ViewType } from 'meme-gtd-shared';

export default class ProjectCreate extends Command {
  static summary = 'Create a new project';
  static description =
    'Create a new project with an optional description, view type, status, and schedule. ' +
    'Projects can use board view (default) or table view.';
  static usage = ['<%= command.id %> <name> [--description <text>] [--view <type>] [--status <status>] [--start-date <date>] [--end-date <date>] [--json]'];
  static examples = [
    '$ mgtd project create "Sprint 1"',
    '$ mgtd project create "Q4 Goals" --description "Year-end objectives"',
    '$ mgtd project create "Bug Tracker" --view table',
    '$ mgtd project create "Active Project" --status active --start-date 2023-01-01 --end-date 2023-12-31',
    '$ mgtd project create "API Development" --json'
  ];

  static args = {
    name: Args.string({
      description: 'Project name (must be unique)',
      required: true
    })
  };

  static flags = {
    description: Flags.string({
      char: 'd',
      summary: 'Project description',
      description: 'Optional description for the project'
    }),
    view: Flags.string({
      char: 'v',
      summary: 'View type (board or table)',
      description: 'Project view type. Board view includes columns, table view does not.',
      options: ['board', 'table'],
      default: 'board'
    }),
    status: Flags.string({
      summary: 'Project status',
      description: 'Project status (planned, active, paused, done, canceled)',
      options: ['planned', 'active', 'paused', 'done', 'canceled'],
      default: 'planned'
    }),
    'start-date': Flags.string({
      summary: 'Start date (YYYY-MM-DD)',
      description: 'Project start date in YYYY-MM-DD format'
    }),
    'end-date': Flags.string({
      summary: 'End date (YYYY-MM-DD)',
      description: 'Project end date in YYYY-MM-DD format'
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the created project as JSON',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ProjectCreate);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new ProjectService({ config });

    try {
      const project = service.create({
        name: args.name,
        description: flags.description,
        view: flags.view as ViewType,
        status: flags.status as any,
        startDate: flags['start-date'],
        endDate: flags['end-date']
      });

      if (flags.json) {
        this.log(JSON.stringify(project, null, 2));
        return;
      }

      // Human-readable output
      this.log(`Project created: #${project.id} - ${project.name}`);
      if (project.description) {
        this.log(`Description: ${project.description}`);
      }
      this.log(`Status: ${project.status}`);
      if (project.startDate) {
        this.log(`Start Date: ${project.startDate}`);
      }
      if (project.endDate) {
        this.log(`End Date: ${project.endDate}`);
      }
      this.log(`View type: ${project.viewMeta.viewType}`);
    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }
  }
}
