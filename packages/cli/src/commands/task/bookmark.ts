import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskBookmark extends Command {
  static summary = 'Mark a task as bookmarked for quick access';
  static description =
    'Set the bookmark flag on a task. Bookmarked tasks can be filtered with "task list --bookmarked". ' +
    'This operation is idempotent: bookmarking an already-bookmarked task succeeds without error.';
  static usage = ['<%= command.id %> <id> [--json]'];
  static examples = [
    '$ mgtd task bookmark 12',
    '$ mgtd task bookmark 12 --json'
  ];

  static args = {
    id: Args.integer({
      description: 'Task ID to bookmark',
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
    const { args, flags } = await this.parse(TaskBookmark);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    try {
      service.setBookmark(args.id, true);

      if (flags.json) {
        this.log(JSON.stringify({ id: args.id, isBookmarked: true }));
        return;
      }

      this.log(`Bookmarked task #${args.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(message, { exit: 1 });
    }
  }
}
