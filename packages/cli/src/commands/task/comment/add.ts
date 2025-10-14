import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';
import { loadBodyFromFile } from '../../../lib/io.js';
import { maybePromptEditor } from '../../../lib/editor.js';
import { detectLegacyFlags, formatLegacyFlagError } from '../../../lib/legacy-flags.js';

export default class TaskCommentAdd extends Command {
  static summary = 'Add a new task comment';
  static description =
    'Append a comment to a task. Supply the comment body inline, via file/stdin, or let the editor launch.';
  static usage = [
    '<%= command.id %> <taskId> [--body <text> | --body-file <path>] [--json]'
  ];
  static examples = [
    '$ mgtd task comment add 1 --body "reviewed the requirements"',
    '$ mgtd task comment add 2 --body-file notes.md'
  ];

  static args = {
    id: Args.integer({ description: 'Task ID', required: true })
  } as const;

  static flags = {
    body: Flags.string({
      char: 'b',
      summary: 'Inline comment body',
      description: 'Provide the comment Markdown directly on the command line.'
    }),
    'body-file': Flags.string({
      char: 'f',
      summary: 'Load comment body from file/stdin',
      description: 'Use "-" to read from stdin, or pass a path to a Markdown file.'
    }),
    editor: Flags.boolean({
      summary: 'Force editor launch',
      description: 'Always launch the configured editor, even when body content is provided.',
      exclusive: ['no-editor']
    }),
    'no-editor': Flags.boolean({
      summary: 'Suppress editor launch',
      description: 'Never launch the editor, even when body content is missing.',
      exclusive: ['editor']
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the created comment as JSON for scripting.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    // 旧フラグ検出
    const legacyResult = detectLegacyFlags({
      '--bodyFile': '--body-file'
    });

    if (legacyResult.detected) {
      this.error(formatLegacyFlagError(legacyResult));
    }

    const { args, flags } = await this.parse(TaskCommentAdd);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    let body = flags.body ?? '';
    if (!body && flags['body-file']) {
      body = await loadBodyFromFile(flags['body-file']);
    }

    // エディタ起動の制御
    const editorResult = await maybePromptEditor({
      editor: flags.editor,
      noEditor: flags['no-editor'],
      initialContent: body
    });

    if (editorResult !== undefined) {
      body = editorResult;
    }
    if (!body.trim()) {
      this.error('Comment body cannot be empty.');
    }

    const comment = service.addComment(args.id, body);

    if (flags.json) {
      this.log(JSON.stringify({ comment }, null, 2));
      return;
    }

    this.log(`Added comment #${comment.id} to task #${args.id}`);
  }
}
