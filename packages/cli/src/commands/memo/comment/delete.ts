import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoCommentDelete extends Command {
  static description = 'Delete a memo comment';

  static args = {
    memoId: Args.integer({ description: 'Memo ID', required: true }),
    commentId: Args.integer({ description: 'Comment ID', required: true })
  } as const;

  static flags = {
    yes: Flags.boolean({ char: 'y', description: 'Skip confirmation', default: false })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoCommentDelete);
    if (!flags.yes) {
      this.log(`This will delete comment #${args.commentId}. Re-run with --yes to confirm.`);
      return;
    }
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });
    service.deleteComment(args.commentId);
    this.log(`Deleted comment #${args.commentId}`);
  }
}
