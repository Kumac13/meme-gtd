import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoCommentDelete extends Command {
  static summary = 'Delete an existing memo comment';
  static description = 'Remove a comment from a memo. Confirmation is required unless --yes is supplied.';
  static usage = ['<%= command.id %> <memoId> <commentId> [--yes]'];
  static examples = [
    '$ mgtd memo comment delete 1 3 --yes'
  ];

  static args = {
    memoId: Args.integer({ description: 'Memo ID', required: true }),
    commentId: Args.integer({ description: 'Comment ID', required: true })
  } as const;

  static flags = {
    yes: Flags.boolean({
      char: 'y',
      summary: 'Skip confirmation prompt',
      description: 'Use in scripts or when you are certain the comment should be removed.',
      default: false
    })
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
