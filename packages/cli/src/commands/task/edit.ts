import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';
import { TaskStatus } from 'meme-gtd-shared';
import { loadBodyFromFile } from '../../lib/io.js';
import { maybePromptEditor } from '../../lib/editor.js';
import { detectLegacyFlags, formatLegacyFlagError } from '../../lib/legacy-flags.js';

export default class TaskEdit extends Command {
  static summary = 'Update task content or metadata';
  static description =
    'Revise a task using inline text, file input, or the editor. You can update title, body, status, scheduled date, and labels.';
  static usage = [
    '<%= command.id %> <taskId> [--title <text>] [--body <text> | --body-file <path>]',
    '<%= command.id %> <taskId> [--status <state>] [--scheduled-on <date>]',
    '<%= command.id %> <taskId> [--add-label <name> ...] [--remove-label <name> ...]',
    '<%= command.id %> <taskId> [--project <id> ...] [--json]'
  ];
  static examples = [
    '$ mgtd task edit 12 --title "Updated title"',
    '$ mgtd task edit 7 --status next',
    '$ mgtd task edit 4 --scheduled-on 2025-10-20',
    '$ mgtd task edit 12 --body-file updated.md',
    '$ mgtd task edit 7 --add-label urgent --remove-label backlog',
    '$ mgtd task edit 4 --project 3 --project 8 --json'
  ];

  static args = {
    id: Args.integer({ description: 'Task ID', required: true })
  } as const;

  static flags = {
    title: Flags.string({
      char: 't',
      summary: 'Update task title',
      description: 'Replace the task title with the provided text.'
    }),
    body: Flags.string({
      char: 'b',
      summary: 'Replace task body inline',
      description: 'Provide the full task Markdown content as a string.'
    }),
    'body-file': Flags.string({
      char: 'f',
      summary: 'Replace task body from file/stdin',
      description: 'Use "-" to read from stdin or pass a file path.'
    }),
    status: Flags.string({
      char: 's',
      summary: 'Update task status',
      description: 'Set task status (inbox, open, next, waiting, scheduled, someday, done, canceled).',
      options: ['inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled']
    }),
    'scheduled-on': Flags.string({
      summary: 'Update scheduled date (ISO 8601)',
      description: 'Set scheduled date in YYYY-MM-DD format. Use empty string to clear.'
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
      description: 'Drop one or more labels from the task.',
      multiple: true
    }),
    project: Flags.integer({
      char: 'p',
      summary: 'Set related project IDs',
      description: 'Override the task project links with the provided IDs.',
      multiple: true
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the updated task payload as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    // 旧フラグ検出
    const legacyResult = detectLegacyFlags({
      '--bodyFile': '--body-file',
      '--addLabel': '--add-label',
      '--removeLabel': '--remove-label',
      '--scheduledOn': '--scheduled-on',
      '--setLabel': 'removed (use: mgtd task label set)',
      '--set-label': 'removed (use: mgtd task label set)'
    });

    if (legacyResult.detected) {
      this.error(formatLegacyFlagError(legacyResult));
    }

    const { args, flags } = await this.parse(TaskEdit);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    let body: string | undefined = flags.body;

    if (!body && flags['body-file']) {
      body = await loadBodyFromFile(flags['body-file']);
    }

    // エディタ起動の判定
    const shouldLaunchEditor = flags.title === undefined &&
                               flags.body === undefined &&
                               flags['body-file'] === undefined &&
                               flags.status === undefined &&
                               flags['scheduled-on'] === undefined &&
                               !flags['add-label'] &&
                               !flags['remove-label'] &&
                               !flags.project &&
                               !flags['no-editor'];

    if (shouldLaunchEditor || flags.editor) {
      const task = service.show(args.id);
      const editorResult = await maybePromptEditor({
        editor: flags.editor || shouldLaunchEditor,
        noEditor: flags['no-editor'],
        initialContent: body || task.bodyMd
      });

      if (editorResult !== undefined) {
        body = editorResult;
      }
    }

    // Validation
    if (flags.title !== undefined && flags.title.trim() === '') {
      this.error('Task title cannot be empty.');
    }

    if (flags['scheduled-on'] !== undefined && flags['scheduled-on'] !== '') {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(flags['scheduled-on'])) {
        this.error('Invalid date format. Use YYYY-MM-DD (ISO 8601).');
      }
    }

    const updateResult = service.edit({
      id: args.id,
      title: flags.title,
      bodyMd: body,
      status: flags.status as TaskStatus | undefined,
      scheduledOn: flags['scheduled-on'] === '' ? null : flags['scheduled-on'],
      addLabels: flags['add-label'],
      removeLabels: flags['remove-label'],
      projectIds: flags.project
    });

    if (flags.json) {
      this.log(JSON.stringify({ task: updateResult }, null, 2));
      return;
    }

    this.log(`Updated task #${updateResult.id}`);
  }
}
