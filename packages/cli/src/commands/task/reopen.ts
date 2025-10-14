import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskReopen extends Command {
  static summary = 'Reopen a closed or canceled task';
  static description =
    'Set task status back to "open" so it can be worked on again.';
  static usage = [
    '<%= command.id %> <taskId> [--json]'
  ];
  static examples = [
    '$ mgtd task reopen 12',
    '$ mgtd task reopen 7 --json'
  ];

  static args = {
    id: Args.integer({ description: 'Task ID', required: true })
  } as const;

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the updated task payload as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskReopen);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    const task = service.reopen(args.id);

    if (flags.json) {
      this.log(JSON.stringify({ task }, null, 2));
      return;
    }

    this.log(`Reopened task #${task.id}`);
  }
}
