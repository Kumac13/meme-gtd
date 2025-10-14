import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoBookmark extends Command {
  static summary = 'Mark a memo as bookmarked for quick access';
  static description =
    'Set the bookmark flag on a memo. Bookmarked memos can be filtered with "memo list --bookmarked". ' +
    'This operation is idempotent: bookmarking an already-bookmarked memo succeeds without error.';
  static usage = ['<%= command.id %> <id> [--json]'];
  static examples = [
    '$ mgtd memo bookmark 12',
    '$ mgtd memo bookmark 12 --json'
  ];

  static args = {
    id: Args.integer({
      description: 'Memo ID to bookmark',
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
    const { args, flags } = await this.parse(MemoBookmark);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    try {
      service.setBookmark(args.id, true);

      if (flags.json) {
        this.log(JSON.stringify({ id: args.id, isBookmarked: true }));
        return;
      }

      this.log(`Bookmarked memo #${args.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(message, { exit: 1 });
    }
  }
}
