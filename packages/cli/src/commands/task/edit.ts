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
    '<%= command.id %> <taskId> [--status <state>] [--scheduled-start <datetime>] [--scheduled-end <datetime>]',
    '<%= command.id %> <taskId> [--all-day | --no-all-day] [--actual-start <datetime>] [--actual-end <datetime>]',
    '<%= command.id %> <taskId> [--add-label <name> ...] [--remove-label <name> ...]',
    '<%= command.id %> <taskId> [--project <id> ...] [--json]'
  ];
  static examples = [
    '$ mgtd task edit 12 --title "Updated title"',
    '$ mgtd task edit 7 --status next',
    '$ mgtd task edit 4 --scheduled-start 2025-10-20T14:00:00 --scheduled-end 2025-10-20T15:00:00',
    '$ mgtd task edit 8 --scheduled-start 2025-10-21T00:00:00 --all-day',
    '$ mgtd task edit 5 --actual-start 2025-10-20T14:30:00 --actual-end 2025-10-20T15:45:00',
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
    // New scheduling fields (ISO 8601 datetime)
    'scheduled-start': Flags.string({
      summary: 'Update scheduled start datetime (ISO 8601)',
      description: 'Set scheduled start datetime in YYYY-MM-DDTHH:MM:SS format. Use empty string to clear.'
    }),
    'scheduled-end': Flags.string({
      summary: 'Update scheduled end datetime (ISO 8601)',
      description: 'Set scheduled end datetime in YYYY-MM-DDTHH:MM:SS format. Use empty string to clear.'
    }),
    'all-day': Flags.boolean({
      summary: 'Mark as all-day event',
      description: 'Mark as an all-day event.',
      allowNo: true
    }),
    // Execution fields (for manual override)
    'actual-start': Flags.string({
      summary: 'Update actual start datetime (ISO 8601)',
      description: 'Set actual start datetime in YYYY-MM-DDTHH:MM:SS format. Use empty string to clear.'
    }),
    'actual-end': Flags.string({
      summary: 'Update actual end datetime (ISO 8601)',
      description: 'Set actual end datetime in YYYY-MM-DDTHH:MM:SS format. Use empty string to clear.'
    }),
    // Deprecated fields (kept for backward compatibility)
    'scheduled-on': Flags.string({
      summary: 'Update scheduled date (DEPRECATED)',
      description: '[DEPRECATED: use --scheduled-start] Set scheduled date in YYYY-MM-DD format. Use empty string to clear.'
    }),
    start: Flags.string({
      summary: 'Update start time (DEPRECATED)',
      description: '[DEPRECATED: use --scheduled-start] Set start time in HH:MM format. Use empty string to clear.'
    }),
    'end-date': Flags.string({
      summary: 'Update end date (DEPRECATED)',
      description: '[DEPRECATED: use --scheduled-end] Set end date in YYYY-MM-DD format. Use empty string to clear.'
    }),
    end: Flags.string({
      summary: 'Update end time (DEPRECATED)',
      description: '[DEPRECATED: use --scheduled-end] Set end time in HH:MM format. Use empty string to clear.'
    }),
    duration: Flags.integer({
      summary: 'Update duration (minutes)',
      description: 'Set duration in minutes. Use 0 to clear.'
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
      flags['scheduled-start'] === undefined &&
      flags['scheduled-end'] === undefined &&
      flags['all-day'] === undefined &&
      flags['actual-start'] === undefined &&
      flags['actual-end'] === undefined &&
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
      // New scheduling fields
      scheduledStart: flags['scheduled-start'] === '' ? null : flags['scheduled-start'],
      scheduledEnd: flags['scheduled-end'] === '' ? null : flags['scheduled-end'],
      isAllDay: flags['all-day'],
      // Execution fields (for manual override)
      actualStart: flags['actual-start'] === '' ? null : flags['actual-start'],
      actualEnd: flags['actual-end'] === '' ? null : flags['actual-end'],
      // Deprecated fields (kept for backward compatibility)
      scheduledOn: flags['scheduled-on'] === '' ? null : flags['scheduled-on'],
      startTime: flags.start === '' ? null : flags.start,
      endDate: flags['end-date'] === '' ? null : flags['end-date'],
      endTime: flags.end === '' ? null : flags.end,
      duration: flags.duration === 0 ? null : flags.duration,
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
