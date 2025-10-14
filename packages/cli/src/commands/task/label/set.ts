import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskLabelSet extends Command {
  static summary = 'Replace task labels';
  static description =
    'Overwrite the task label set with the provided list. Any omitted labels will be removed.';
  static usage = ['<%= command.id %> <taskId> --label <name> [--label <name> ...] [--json]'];
  static examples = [
    '$ mgtd task label set 14 --label urgent --label backend',
    '$ mgtd task label set 14 --label focus --json'
  ];

  static args = {
    id: Args.integer({ description: 'Task ID', required: true })
  } as const;

  static flags = {
    label: Flags.string({
      char: 'l',
      summary: 'Labels to use',
      description: 'Provide the complete list of labels that should remain on the task.',
      multiple: true,
      required: true
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the task and final label list as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskLabelSet);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    service.setLabels(args.id, flags.label);
    const task = service.show(args.id);
    const labels = service.listLabels(args.id);

    if (flags.json) {
      this.log(JSON.stringify({ task, labels }, null, 2));
      return;
    }
    this.log(`Labels updated for task #${task.id}: ${labels.join(', ') || '(none)'}`);
  }
}
