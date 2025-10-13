import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';
import { loadBodyFromFile } from '../../../lib/io.js';
import { promptEditor } from '../../../lib/editor.js';

export default class MemoCommentEdit extends Command {
  static summary = 'Edit an existing memo comment';
  static examples = [
    '$ mgtd memo comment edit 1 3 --body "updated comment"',
    '$ mgtd memo comment edit 2 1 --body-file patch.md'
  ];

  static args = {
    memoId: Args.integer({ description: 'Memo ID', required: true }),
    commentId: Args.integer({ description: 'Comment ID', required: true })
  } as const;

  static flags = {
    body: Flags.string({ description: 'New comment body' }),
    bodyFile: Flags.string({ description: 'Load body from file or stdin (-)' }),
    json: Flags.boolean({ description: 'Output JSON', default: false })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoCommentEdit);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    let body = flags.body ?? '';
    if (!body && flags.bodyFile) {
      body = await loadBodyFromFile(flags.bodyFile);
    }
    if (!body) {
      const comments = service.listComments(args.memoId);
      const existing = comments.find((c) => c.id === args.commentId);
      if (!existing) {
        this.error(`Comment #${args.commentId} not found for memo #${args.memoId}`);
      }
      body = await promptEditor(existing!.bodyMd);
    }

    const updated = service.updateComment(args.commentId, body);

    if (flags.json) {
      this.log(JSON.stringify({ comment: updated }, null, 2));
      return;
    }

    this.log(`Updated comment #${updated.id}`);
  }
}
