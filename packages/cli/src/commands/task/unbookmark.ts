import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskUnbookmark extends Command {
  static summary = 'Remove bookmark from a task';
  static description =
    'Unset the bookmark flag on a task. ' +
    'This operation is idempotent: unbookmarking a non-bookmarked task succeeds without error.';
  static usage = ['<%= command.id %> <id> [--json]'];
  static examples = [
    '$ mgtd task unbookmark 12',
    '$ mgtd task unbookmark 12 --json'
  ];

  static args = {
    id: Args.integer({
      description: 'Task ID to unbookmark',
      required: true
    })
  } as const;

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Return the bookmark status in JSON format.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskUnbookmark);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    try {
      service.setBookmark(args.id, false);

      if (flags.json) {
        this.log(JSON.stringify({ id: args.id, isBookmarked: false }));
        return;
      }

      this.log(`Removed bookmark from task #${args.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(message, { exit: 1 });
    }
  }
}
