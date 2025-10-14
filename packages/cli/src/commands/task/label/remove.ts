import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskLabelRemove extends Command {
  static summary = 'Remove task labels';
  static description =
    'Detach one or more labels from a task. Remaining labels are left untouched.';
  static usage = ['<%= command.id %> <taskId> --label <name> [--label <name> ...] [--json]'];
  static examples = [
    '$ mgtd task label remove 12 --label backlog',
    '$ mgtd task label remove 12 --label backlog --label weekly --json'
  ];

  static args = {
    id: Args.integer({ description: 'Task ID', required: true })
  } as const;

  static flags = {
    label: Flags.string({
      char: 'l',
      summary: 'Labels to remove',
      description: 'Provide one or more labels that should be removed from the task.',
      multiple: true,
      required: true
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the updated task and label list in JSON format.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskLabelRemove);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    const task = service.edit({ id: args.id, removeLabels: flags.label });

    if (flags.json) {
      this.log(JSON.stringify({ task, labels: service.listLabels(args.id) }, null, 2));
      return;
    }
    this.log(`Labels removed from task #${task.id}`);
  }
}
