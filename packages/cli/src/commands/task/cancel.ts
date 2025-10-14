import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskCancel extends Command {
  static summary = 'Mark task as canceled';
  static description =
    'Set task status to "canceled" and optionally add a reason comment.';
  static usage = [
    '<%= command.id %> <taskId> [--comment <text>] [--json]'
  ];
  static examples = [
    '$ mgtd task cancel 12',
    '$ mgtd task cancel 7 --comment "No longer needed"',
    '$ mgtd task cancel 4 --json'
  ];

  static args = {
    id: Args.integer({ description: 'Task ID', required: true })
  } as const;

  static flags = {
    comment: Flags.string({
      char: 'c',
      summary: 'Add a cancellation reason',
      description: 'Attach a comment explaining why the task was canceled.'
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the updated task payload as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskCancel);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    const task = service.cancel(args.id, flags.comment);

    if (flags.json) {
      this.log(JSON.stringify({ task }, null, 2));
      return;
    }

    this.log(`Canceled task #${task.id}`);
  }
}
