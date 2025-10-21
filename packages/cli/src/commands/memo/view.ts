import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoView extends Command {
  static summary = 'Show memo details';
  static description =
    'Display memo metadata, body text, and optionally the associated comments.';
  static usage = ['<%= command.id %> <memoId> [--comments] [--json]'];
  static examples = [
    '$ mgtd memo view 9',
    '$ mgtd memo view 12 --comments',
    '$ mgtd memo view 12 --comments --json'
  ];

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Return the memo, labels, and (optional) comments as JSON.',
      default: false
    }),
    comments: Flags.boolean({
      char: 'c',
      summary: 'Include memo comments',
      description: 'Append memo comments after the memo body (or within the JSON payload).',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoView);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    const memo = service.show(args.id);
    const comments = flags.comments ? service.listComments(args.id) : [];

    if (flags.json) {
      this.log(JSON.stringify({ memo, comments }, null, 2));
      return;
    }

    this.log(`Memo #${memo.id}`);
    this.log(`Updated: ${memo.updatedAt}`);
    this.log(`Labels: ${memo.labels && memo.labels.length > 0 ? memo.labels.join(', ') : '(none)'}`);
    this.log('---');
    this.log(memo.bodyMd);

    if (comments.length) {
      this.log('\nComments:');
      comments.forEach((comment) => {
        this.log(`- [${comment.id}] ${comment.bodyMd}`);
      });
    }
  }
}
