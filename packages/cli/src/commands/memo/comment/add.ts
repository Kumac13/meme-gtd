import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';
import { loadBodyFromFile } from '../../../lib/io.js';
import { promptEditor } from '../../../lib/editor.js';

export default class MemoCommentAdd extends Command {
  static summary = 'Add a new memo comment';
  static description =
    'Append a comment to a memo. Supply the comment body inline, via file/stdin, or let the editor launch.';
  static usage = [
    '<%= command.id %> <memoId> [--body <text> | --body-file <path>] [--json]'
  ];
  static examples = [
    '$ mgtd memo comment add 1 --body "reviewed the spec"',
    '$ mgtd memo comment add 2 --body-file notes.md'
  ];

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    body: Flags.string({
      char: 'b',
      summary: 'Inline comment body',
      description: 'Provide the comment Markdown directly on the command line.'
    }),
    bodyFile: Flags.string({
      char: 'f',
      summary: 'Load comment body from file/stdin',
      description: 'Use "-" to read from stdin, or pass a path to a Markdown file.'
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the created comment as JSON for scripting.',
      default: false
    })
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
