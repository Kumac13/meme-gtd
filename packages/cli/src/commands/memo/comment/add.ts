import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';
import { loadBodyFromFile } from '../../../lib/io.js';
import { promptEditor } from '../../../lib/editor.js';

export default class MemoCommentAdd extends Command {
  static summary = 'Add a new comment to a memo';
  static examples = [
    '$ mgtd memo comment add 1 --body "reviewed the spec"',
    '$ mgtd memo comment add 2 --body-file notes.md'
  ];

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    body: Flags.string({ description: 'Comment body' }),
    bodyFile: Flags.string({ description: 'Load comment body from file or stdin (-)' }),
    json: Flags.boolean({ description: 'Output JSON', default: false })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoCommentAdd);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    let body = flags.body ?? '';
    if (!body && flags.bodyFile) {
      body = await loadBodyFromFile(flags.bodyFile);
    }
    if (!body) {
      body = await promptEditor();
    }
    if (!body.trim()) {
      this.error('Comment body cannot be empty.');
    }

    const comment = service.addComment(args.id, body);

    if (flags.json) {
      this.log(JSON.stringify({ comment }, null, 2));
      return;
    }

    this.log(`Added comment #${comment.id} to memo #${args.id}`);
  }
}
