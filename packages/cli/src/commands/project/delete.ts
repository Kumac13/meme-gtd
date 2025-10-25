import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ProjectService } from 'meme-gtd-core';
import * as readline from 'readline';

export default class ProjectDelete extends Command {
  static summary = 'Delete a project';
  static description =
    'Delete a project and all its items. Issues (tasks/memos) remain intact. ' +
    'Unless --yes is supplied, you will receive a confirmation prompt.';
  static usage = ['<%= command.id %> <project-id> [--yes] [--json]'];
  static examples = [
    '$ mgtd project delete 5',
    '$ mgtd project delete 5 --yes',
    '$ mgtd project delete 5 -y -j'
  ];

  static args = {
    'project-id': Args.integer({
      description: 'Project ID to delete',
      required: true
    })
  } as const;

  static flags = {
    yes: Flags.boolean({
      char: 'y',
      summary: 'Skip confirmation prompt',
      description: 'Force deletion in non-interactive settings',
      default: false
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the result as JSON object',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ProjectDelete);
    const projectId = args['project-id'];
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new ProjectService({ config });

    // JSON mode requires --yes flag
    if (flags.json && !flags.yes) {
      this.log(
        JSON.stringify({
          deleted: false,
          projectId,
          reason: 'JSON mode requires --yes flag for confirmation'
        })
      );
      return;
    }

    // Get project for preview (also validates it exists)
    let project;
    try {
      project = service.getById(projectId);
    } catch (error) {
      if (flags.json) {
        this.log(
          JSON.stringify({
            deleted: false,
            projectId,
            reason: error instanceof Error ? error.message : 'Unknown error'
          })
        );
        return;
      }
      this.error(error instanceof Error ? error.message : 'Unknown error', { exit: 1 });
    }

    // Interactive confirmation if not forced
    if (!flags.yes && process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      this.log(`Project: #${project.id} - ${project.name}`);
      if (project.items.length > 0) {
        this.log(`Warning: This project contains ${project.items.length} item(s)`);
      }

      const confirmed = await new Promise<boolean>((resolve) => {
        rl.question(`Delete project #${projectId}? (y/N) `, (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y');
        });
      });

      if (!confirmed) {
        this.log('Cancelled');
        return;
      }
    }

    try {
      service.delete(projectId);

      if (flags.json) {
        this.log(JSON.stringify({ deleted: true, projectId }));
        return;
      }

      this.log(`Deleted project #${projectId}`);
    } catch (error) {
      if (flags.json) {
        this.log(
          JSON.stringify({
            deleted: false,
            projectId,
            reason: error instanceof Error ? error.message : 'Unknown error'
          })
        );
        return;
      }
      this.error(error instanceof Error ? error.message : 'Unknown error', { exit: 1 });
    }
  }
}
