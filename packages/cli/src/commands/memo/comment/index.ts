import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoCommentIndex extends Command {
  static summary = 'Inspect memo comments';
  static description = [
    'List the threaded comments attached to a memo. Use the dedicated subcommands',
    'to add, edit, or delete comments when you need to make changes.',
    '',
    'Subcommands:',
    '  add     Add a comment body via --body, --body-file, or the editor.',
    '  edit    Update an existing comment (opens the editor if no body is supplied).',
    '  delete  Remove a comment; requires --yes for non-interactive confirmation.',
    '',
    'Run `mgtd memo comment <subcommand> --help` for detailed usage.'
  ].join('\n');
  static usage = [
    '<%= command.id %> <memoId> [--json]',
    '<%= command.id %> add <memoId> --body "comment"',
    '<%= command.id %> edit <memoId> <commentId> --body "new body"',
    '<%= command.id %> delete <memoId> <commentId> --yes'
  ];
  static examples = [
    '$ mgtd memo comment 42 --json',
    '$ mgtd memo comment add 42 --body "Clarified acceptance criteria"',
    '$ mgtd memo comment edit 42 3 --body-file comment.md',
    '$ mgtd memo comment delete 42 3 --yes'
  ];

  static args = {
    id: Args.integer({ description: 'Memo ID to inspect', required: true })
  } as const;

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Write the memo comments as formatted JSON for downstream tooling.',
      default: false
    })
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
