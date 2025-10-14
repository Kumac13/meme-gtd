import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';
import * as readline from 'readline';

export default class TaskDelete extends Command {
  static summary = 'Soft-delete a task';
  static description =
    'Mark a task as deleted. Unless --yes is supplied you will receive a confirmation hint.';
  static usage = ['<%= command.id %> <taskId> [--yes]'];
  static examples = ['$ mgtd task delete 17 --yes'];

  static args = {
    id: Args.integer({ description: 'Task ID', required: true })
  } as const;

  static flags = {
    yes: Flags.boolean({
      char: 'y',
      summary: 'Skip confirmation prompt',
      description: 'Force deletion in non-interactive settings.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskDelete);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    // Get task for preview (also validates it exists)
    let task;
    try {
      task = service.show(args.id);
    } catch (error) {
      this.error(`Task #${args.id} not found`, { exit: 1 });
    }

    // Non-interactive mode: --yes flag provided
    if (flags.yes) {
      service.remove(args.id);
      this.log(`Task #${args.id} marked as deleted.`);
      return;
    }

    // Check if TTY available
    if (!process.stdin.isTTY) {
      this.error('Cannot prompt for confirmation. Please use --yes flag to confirm deletion.', { exit: 1 });
    }

    // Interactive mode: prompt user
    const preview = `${task.title} [${task.status}]`;
    const confirmed = await this.promptConfirmation(args.id, preview);

    if (confirmed) {
      service.remove(args.id);
      this.log(`Task #${args.id} marked as deleted.`);
    } else {
      this.log('Deletion cancelled.');
    }
  }

  private async promptConfirmation(id: number, preview: string): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      // Handle Ctrl+C
      const sigintHandler = () => {
        rl.close();
        this.log('\nDeletion cancelled.');
        process.exit(130);
      };
      process.once('SIGINT', sigintHandler);

      rl.question(`Delete task #${id}: "${preview}"? (y/n): `, (answer) => {
        process.removeListener('SIGINT', sigintHandler);
        rl.close();

        const normalized = answer.toLowerCase().trim();

        if (['y', 'yes'].includes(normalized)) {
          resolve(true);
        } else if (['n', 'no'].includes(normalized)) {
          resolve(false);
        } else {
          this.log(`Invalid input: "${answer}". Please answer 'y' or 'n'.`);
          this.log('Deletion cancelled.');
          resolve(false);
        }
      });
    });
  }
}
