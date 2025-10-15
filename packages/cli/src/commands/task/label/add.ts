import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskLabelAdd extends Command {
  static summary = 'Add labels to a task';
  static description =
    'Attach one or more labels to a task. Existing labels remain untouched.';
  static usage = ['<%= command.id %> <taskId> --label <name> [--label <name> ...] [--json]'];
  static examples = [
    '$ mgtd task label add 9 --label urgent',
    '$ mgtd task label add 9 --label backend --label review --json'
  ];

  static args = {
    id: Args.integer({ description: 'Task ID', required: true })
  } as const;

  static flags = {
    label: Flags.string({
      char: 'l',
      summary: 'Labels to append',
      description: 'Provide one or more labels to add to the task.',
      multiple: true,
      required: true
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the updated task and labels as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskLabelAdd);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    const task = service.edit({ id: args.id, addLabels: flags.label });

    if (flags.json) {
      this.log(JSON.stringify({ task, labels: service.listLabels(args.id) }, null, 2));
      return;
    }
    this.log(`Labels added to task #${task.id}`);
  }
}
