import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskView extends Command {
  static summary = 'Show task details';
  static description =
    'Display task metadata (title, status, scheduled date), body text, labels, and optionally comments.';
  static usage = ['<%= command.id %> <taskId> [--comments] [--json]'];
  static examples = [
    '$ mgtd task view 5',
    '$ mgtd task view 12 --comments',
    '$ mgtd task view 12 --comments --json'
  ];

  static args = {
    id: Args.integer({ description: 'Task ID', required: true })
  } as const;

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Return the task, labels, and (optional) comments as JSON.',
      default: false
    }),
    comments: Flags.boolean({
      char: 'c',
      summary: 'Include task comments',
      description: 'Append task comments after the task body (or within the JSON payload).',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskView);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    const task = service.show(args.id);
    const comments = flags.comments ? service.listComments(args.id) : [];

    if (flags.json) {
      this.log(JSON.stringify({ task, comments }, null, 2));
      return;
    }

    const bookmarkIndicator = task.isBookmarked ? ' ★' : '';
    this.log(`Task #${task.id}: ${task.title}${bookmarkIndicator}`);
    this.log(`Status: ${task.status}`);
    if (task.scheduledOn) {
      this.log(`Scheduled: ${task.scheduledOn}`);
    }
    this.log(`Updated: ${task.updatedAt}`);
    this.log(`Labels: ${task.labels && task.labels.length > 0 ? task.labels.join(', ') : '(none)'}`);
    this.log('---');
    this.log(task.bodyMd || '(no body)');

    if (comments.length) {
      this.log('\nComments:');
      comments.forEach((comment) => {
        this.log(`- [${comment.id}] ${comment.bodyMd}`);
      });
    }
  }
}
