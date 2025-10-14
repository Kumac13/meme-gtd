import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskClose extends Command {
  static summary = 'Mark task as done';
  static description =
    'Set task status to "done" and optionally add a closing comment.';
  static usage = [
    '<%= command.id %> <taskId> [--comment <text>] [--json]'
  ];
  static examples = [
    '$ mgtd task close 12',
    '$ mgtd task close 7 --comment "Completed successfully"',
    '$ mgtd task close 4 --json'
  ];

  static args = {
    id: Args.integer({ description: 'Task ID', required: true })
  } as const;

  static flags = {
    comment: Flags.string({
      char: 'c',
      summary: 'Add a closing comment',
      description: 'Attach a comment explaining why or how the task was completed.'
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the updated task payload as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskClose);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    const task = service.close(args.id, flags.comment);

    if (flags.json) {
      this.log(JSON.stringify({ task }, null, 2));
      return;
    }

    this.log(`Closed task #${task.id}`);
  }
}
