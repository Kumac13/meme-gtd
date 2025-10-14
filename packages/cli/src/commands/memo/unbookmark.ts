import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoUnbookmark extends Command {
  static summary = 'Remove bookmark from a memo';
  static description =
    'Unset the bookmark flag on a memo. ' +
    'This operation is idempotent: unbookmarking a non-bookmarked memo succeeds without error.';
  static usage = ['<%= command.id %> <id> [--json]'];
  static examples = [
    '$ mgtd memo unbookmark 12',
    '$ mgtd memo unbookmark 12 --json'
  ];

  static args = {
    id: Args.integer({
      description: 'Memo ID to unbookmark',
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
    const { args, flags } = await this.parse(MemoUnbookmark);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    try {
      service.setBookmark(args.id, false);

      if (flags.json) {
        this.log(JSON.stringify({ id: args.id, isBookmarked: false }));
        return;
      }

      this.log(`Removed bookmark from memo #${args.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(message, { exit: 1 });
    }
  }
}
