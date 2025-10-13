import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoCommentIndex extends Command {
  static description = 'List comments for a memo';

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    json: Flags.boolean({ description: 'Output JSON', default: false })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoCommentIndex);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });
    const comments = service.listComments(args.id);

    if (flags.json) {
      this.log(JSON.stringify({ memoId: args.id, comments }, null, 2));
      return;
    }

    if (comments.length === 0) {
      this.log(`Memo #${args.id} has no comments.`);
      return;
    }

    comments.forEach((comment) => {
      this.log(`[${comment.id}] ${comment.bodyMd}`);
    });
  }
}
