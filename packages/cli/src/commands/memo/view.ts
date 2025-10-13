import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoView extends Command {
  static description = 'View a memo in detail';

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    json: Flags.boolean({ description: 'Output JSON', default: false }),
    comments: Flags.boolean({ char: 'c', description: 'Include comments', default: false })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoView);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    const memo = service.show(args.id);
    const labels = service.listLabels(args.id);
    const comments = flags.comments ? service.listComments(args.id) : [];

    if (flags.json) {
      this.log(JSON.stringify({ memo, labels, comments }, null, 2));
      return;
    }

    this.log(`Memo #${memo.id}`);
    this.log(`Updated: ${memo.updatedAt}`);
    this.log(`Labels: ${labels.join(', ') || '(none)'}`);
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
