import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';
import { loadBodyFromFile } from '../../lib/io.js';
import { promptEditor, maybePromptEditor } from '../../lib/editor.js';
import { detectLegacyFlags, formatLegacyFlagError } from '../../lib/legacy-flags.js';

export default class MemoEdit extends Command {
  static summary = 'Update memo content or metadata';
  static description =
    'Revise a memo using inline text, file input, or the editor. You can also adjust labels and project links.';
  static usage = [
    '<%= command.id %> <memoId> [--body <text> | --body-file <path>]',
    '<%= command.id %> <memoId> [--add-label <name> ...] [--remove-label <name> ...]',
    '<%= command.id %> <memoId> [--project <id> ...] [--json]'
  ];
  static examples = [
    '$ mgtd memo edit 12 --body-file scratch.md',
    '$ mgtd memo edit 7 --add-label triage --remove-label backlog',
    '$ mgtd memo edit 4 --project 3 --project 8 --json'
  ];

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    body: Flags.string({
      char: 'b',
      summary: 'Replace memo text inline',
      description: 'Provide the full memo Markdown content as a string.'
    }),
    'body-file': Flags.string({
      char: 'f',
      summary: 'Replace memo text from file/stdin',
      description: 'Use "-" to read from stdin or pass a file path.'
    }),
    editor: Flags.boolean({
      summary: 'Force editor launch',
      description: 'Always launch the configured editor with existing content.',
      exclusive: ['no-editor']
    }),
    'no-editor': Flags.boolean({
      summary: 'Suppress editor launch',
      description: 'Never launch the editor, only apply flag-based changes.',
      exclusive: ['editor']
    }),
    'add-label': Flags.string({
      char: 'a',
      summary: 'Labels to add',
      description: 'Append one or more labels without removing existing ones.',
      multiple: true
    }),
    'remove-label': Flags.string({
      char: 'r',
      summary: 'Labels to remove',
      description: 'Drop one or more labels from the memo.',
      multiple: true
    }),
    project: Flags.integer({
      char: 'p',
      summary: 'Set related project IDs',
      description: 'Override the memo project links with the provided IDs.',
      multiple: true
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the updated memo payload as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    // 旧フラグ検出
    const legacyResult = detectLegacyFlags({
      '--bodyFile': '--body-file',
      '--addLabel': '--add-label',
      '--removeLabel': '--remove-label',
      '--setLabel': 'removed (use: mgtd memo label set)',
      '--set-label': 'removed (use: mgtd memo label set)'
    });

    if (legacyResult.detected) {
      this.error(formatLegacyFlagError(legacyResult));
    }

    const { args, flags } = await this.parse(MemoEdit);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    let body: string | undefined = flags.body;

    if (!body && flags['body-file']) {
      body = await loadBodyFromFile(flags['body-file']);
    }

    // エディタ起動の判定
    const shouldLaunchEditor = flags.body === undefined &&
                               flags['body-file'] === undefined &&
                               !flags['add-label'] &&
                               !flags['remove-label'] &&
                               !flags.project &&
                               !flags['no-editor'];

    if (shouldLaunchEditor || flags.editor) {
      const memo = service.show(args.id);
      const editorResult = await maybePromptEditor({
        editor: flags.editor || shouldLaunchEditor,
        noEditor: flags['no-editor'],
        initialContent: body || memo.bodyMd
      });

      if (editorResult !== undefined) {
        body = editorResult;
      }
    }

    const updateResult = service.edit({
      id: args.id,
      bodyMd: body,
      addLabels: flags['add-label'],
      removeLabels: flags['remove-label'],
      projectIds: flags.project
    });

    if (flags.json) {
      this.log(JSON.stringify({ memo: updateResult }, null, 2));
      return;
    }

    this.log(`Updated memo #${updateResult.id}`);
  }
}
