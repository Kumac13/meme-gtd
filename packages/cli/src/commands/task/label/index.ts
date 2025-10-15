import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskLabelIndex extends Command {
  static summary = 'List task labels';
  static description =
    'Show labels currently attached to a task. Use the add/remove/set subcommands to update assignments.';
  static usage = ['<%= command.id %> <taskId> [--json]'];
  static examples = ['$ mgtd task label 17', '$ mgtd task label 17 --json'];

  static args = {
    id: Args.integer({ description: 'Task ID', required: true })
  } as const;

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the task labels as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskLabelIndex);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });
    const labels = service.listLabels(args.id);

    if (flags.json) {
      this.log(JSON.stringify({ taskId: args.id, labels }, null, 2));
      return;
    }

    if (labels.length === 0) {
      this.log(`Task #${args.id} has no labels.`);
      return;
    }

    this.log(labels.join(', '));
  }
}
