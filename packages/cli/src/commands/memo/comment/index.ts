import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoCommentIndex extends Command {
  static summary = 'List comments for a memo or discover comment subcommands';
  static description = `表示対象のメモ ID を指定するとコメント一覧を表示します。コメントの追加・編集・削除は add/edit/delete サブコマンドを利用してください。`;
  static usage = [
    'mgtd memo comment <memoId> [--json]',
    'mgtd memo comment add <memoId> --body "comment"',
    'mgtd memo comment edit <memoId> <commentId> --body "new body"',
    'mgtd memo comment delete <memoId> <commentId> --yes'
  ];
  static examples = [
    '$ mgtd memo comment 1 --json',
    '$ mgtd memo comment add 1 --body "refinement"',
    '$ mgtd memo comment edit 1 3 --body "updated"',
    '$ mgtd memo comment delete 1 3 --yes'
  ];

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
