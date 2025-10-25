import { Command, Flags, Args } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ProjectService } from 'meme-gtd-core';

export default class ProjectView extends Command {
  static summary = 'View project details with items';
  static description = 'Display project information and all associated items ordered by position.';
  static usage = ['<%= command.id %> <project-id> [--json]'];
  static examples = [
    '$ mgtd project view 5',
    '$ mgtd project view 3 --json'
  ];

  static args = {
    'project-id': Args.integer({
      description: 'Project ID',
      required: true
    })
  };

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the project details as JSON',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ProjectView);
    const projectId = args['project-id'];
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new ProjectService({ config });

    try {
      const project = service.getById(projectId);

      if (flags.json) {
        this.log(JSON.stringify(project, null, 2));
        return;
      }

      // Human-readable output
      this.log(`Project #${project.id}: ${project.name}`);
      if (project.description) {
        this.log(`Description: ${project.description}`);
      }
      this.log(`View: ${project.viewMeta.viewType}`);
      if (project.viewMeta.columns) {
        this.log(`Columns: ${project.viewMeta.columns.join(', ')}`);
      }
      this.log(`Created: ${project.createdAt}\n`);

      if (project.items.length === 0) {
        this.log('No items in this project');
        return;
      }

      this.log(`Items (${project.items.length}):\n`);

      // Calculate column widths for alignment
      const maxIdWidth = Math.max(...project.items.map(item => String(item.issueId).length));
      const maxTypeWidth = Math.max(...project.items.map(item => item.issue.type.length));

      for (const item of project.items) {
        const idPadded = String(item.issueId).padStart(maxIdWidth);
        const typePadded = item.issue.type.padEnd(maxTypeWidth);
        const column = item.viewMeta?.column ? ` [${item.viewMeta.column}]` : '';

        this.log(`  #${idPadded}  ${typePadded}  ${item.issue.title}${column}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }
  }
}
