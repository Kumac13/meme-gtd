import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ProjectService } from 'meme-gtd-core';
import * as readline from 'readline';

export default class ProjectRemove extends Command {
  static summary = 'Remove an issue from a project';
  static description =
    'Remove a task or memo from a project. The issue itself remains intact. ' +
    'Unless --yes is supplied, you will receive a confirmation prompt.';
  static usage = ['<%= command.id %> <project-id> <issue-id> [--yes] [--json]'];
  static examples = [
    '$ mgtd project remove 5 12',
    '$ mgtd project remove 5 12 --yes',
    '$ mgtd project remove 5 12 -y -j'
  ];

  static args = {
    'project-id': Args.integer({
      description: 'Project ID',
      required: true
    }),
    'issue-id': Args.integer({
      description: 'Issue ID to remove',
      required: true
    })
  } as const;

  static flags = {
    yes: Flags.boolean({
      char: 'y',
      summary: 'Skip confirmation prompt',
      description: 'Force removal in non-interactive settings',
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
    const { args, flags } = await this.parse(ProjectRemove);
    const projectId = args['project-id'];
    const issueId = args['issue-id'];
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new ProjectService({ config });

    // JSON mode requires --yes flag
    if (flags.json && !flags.yes) {
      this.log(
        JSON.stringify({
          removed: false,
          projectId,
          issueId,
          reason: 'JSON mode requires --yes flag for confirmation'
        })
      );
      return;
    }

    // Interactive confirmation if not forced
    if (!flags.yes && process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const confirmed = await new Promise<boolean>((resolve) => {
        rl.question(
          `Remove issue #${issueId} from project #${projectId}? (y/N) `,
          (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
          }
        );
      });

      if (!confirmed) {
        this.log('Cancelled');
        return;
      }
    }

    try {
      service.removeItem(projectId, issueId);

      if (flags.json) {
        this.log(JSON.stringify({ removed: true, projectId, issueId }));
        return;
      }

      this.log(`Removed issue #${issueId} from project #${projectId}`);
    } catch (error) {
      if (flags.json) {
        this.log(
          JSON.stringify({
            removed: false,
            projectId,
            issueId,
            reason: error instanceof Error ? error.message : 'Unknown error'
          })
        );
        return;
      }
      this.error(error instanceof Error ? error.message : 'Unknown error', { exit: 1 });
    }
  }
}
