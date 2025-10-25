import { Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ProjectService } from 'meme-gtd-core';

export default class ProjectList extends Command {
  static summary = 'List all projects';
  static description = 'Display all projects ordered by creation date (newest first).';
  static usage = ['<%= command.id %> [--json]'];
  static examples = [
    '$ mgtd project list',
    '$ mgtd project list --json'
  ];

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the projects as a JSON array',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(ProjectList);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new ProjectService({ config });

    try {
      const projects = service.list();

      if (flags.json) {
        this.log(JSON.stringify({ projects }, null, 2));
        return;
      }

      // Human-readable output
      if (projects.length === 0) {
        this.log('No projects found');
        return;
      }

      this.log('Projects:\n');

      // Calculate column widths for alignment
      const maxIdWidth = Math.max(...projects.map(p => String(p.id).length));
      const maxNameWidth = Math.max(...projects.map(p => p.name.length));

      for (const project of projects) {
        const idPadded = String(project.id).padStart(maxIdWidth);
        const namePadded = project.name.padEnd(maxNameWidth);
        const viewType = project.viewMeta.viewType;

        this.log(`  #${idPadded}  ${namePadded}  [${viewType}]`);
      }
    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }
  }
}
