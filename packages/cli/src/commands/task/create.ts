import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';
import { createLogger } from 'meme-gtd-logger';
import type { TaskStatus } from 'meme-gtd-shared';
import { loadBodyFromFile } from '../../lib/io.js';
import { maybePromptEditor } from '../../lib/editor.js';
import { detectLegacyFlags, formatLegacyFlagError } from '../../lib/legacy-flags.js';

export default class TaskCreate extends Command {
  static summary = 'Create a new task';
  static description =
    'Create a task record with title and body. Tasks support status tracking (inbox/open/next/waiting/scheduled/someday/done/canceled).';
  static usage = [
    '<%= command.id %> --title <text> [--body <text> | --body-file <path>] [--status <state>] [--scheduled-start <datetime>] [--scheduled-end <datetime>] [--all-day] [--label <name> ...] [--project <id> ...] [--json]'
  ];
  static examples = [
    '$ mgtd task create --title "Buy groceries" --body "Milk, eggs, bread"',
    '$ mgtd task create --title "Team meeting" --status scheduled --scheduled-start 2025-10-20T14:00:00 --scheduled-end 2025-10-20T15:00:00',
    '$ mgtd task create --title "Conference trip" --scheduled-start 2025-11-20T00:00:00 --scheduled-end 2025-11-23T23:59:59 --all-day',
    '$ mgtd task create --title "Fix bug" --body-file issue.md --label urgent --label backend',
    '$ mgtd task create --title "Review PR" --label review --json'
  ];

  static args = {} as const;

  static flags = {
    title: Flags.string({
      char: 't',
      summary: 'Task title (required)',
      description: 'Short descriptive title for the task.',
      required: true
    }),
    body: Flags.string({
      char: 'b',
      summary: 'Inline task body',
      description: 'Provide the task body Markdown directly on the command line.'
    }),
    'body-file': Flags.string({
      char: 'f',
      summary: 'Load body content from a file or stdin',
      description: 'Use "-" to read from stdin; otherwise supply a path to a Markdown file.'
    }),
    status: Flags.string({
      char: 's',
      summary: 'Initial status',
      description: 'Set task status (inbox, open, next, waiting, scheduled, someday, done, canceled). Default: inbox',
      options: ['inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'],
      default: 'inbox'
    }),
    // New scheduling fields (ISO 8601 datetime)
    'scheduled-start': Flags.string({
      summary: 'Scheduled start datetime (ISO 8601)',
      description: 'Set scheduled start datetime in YYYY-MM-DDTHH:MM:SS format.'
    }),
    'scheduled-end': Flags.string({
      summary: 'Scheduled end datetime (ISO 8601)',
      description: 'Set scheduled end datetime in YYYY-MM-DDTHH:MM:SS format.'
    }),
    'all-day': Flags.boolean({
      summary: 'All-day event',
      description: 'Mark as an all-day event (only date portion of datetime is used).',
      default: false
    }),
    // Deprecated fields (kept for backward compatibility)
    'scheduled-on': Flags.string({
      summary: 'Scheduled date (DEPRECATED)',
      description: '[DEPRECATED: use --scheduled-start] Set scheduled date in YYYY-MM-DD format.'
    }),
    start: Flags.string({
      summary: 'Start time (DEPRECATED)',
      description: '[DEPRECATED: use --scheduled-start] Set start time in HH:MM format.'
    }),
    'end-date': Flags.string({
      summary: 'End date (DEPRECATED)',
      description: '[DEPRECATED: use --scheduled-end] Set end date in YYYY-MM-DD format.'
    }),
    end: Flags.string({
      summary: 'End time (DEPRECATED)',
      description: '[DEPRECATED: use --scheduled-end] Set end time in HH:MM format.'
    }),
    duration: Flags.integer({
      summary: 'Duration (minutes)',
      description: 'Set duration in minutes.'
    }),
    editor: Flags.boolean({
      summary: 'Force editor launch',
      description: 'Always launch the configured editor for body content, even when body is provided.',
      exclusive: ['no-editor']
    }),
    'no-editor': Flags.boolean({
      summary: 'Suppress editor launch',
      description: 'Never launch the editor, even when body content is missing.',
      exclusive: ['editor']
    }),
    label: Flags.string({
      char: 'l',
      summary: 'Apply labels',
      description: 'Attach one or more labels to the task.',
      multiple: true
    }),
    project: Flags.integer({
      char: 'p',
      summary: 'Associate projects',
      description: 'Link task to one or more project IDs.',
      multiple: true
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Return the created task payload in JSON format.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    // 旧フラグ検出
    const legacyResult = detectLegacyFlags({
      '--bodyFile': '--body-file',
      '--scheduledOn': '--scheduled-on',
      '--noEditor': '--no-editor'
    });

    if (legacyResult.detected) {
      this.error(formatLegacyFlagError(legacyResult));
    }

    const { flags } = await this.parse(TaskCreate);
    const { config } = await loadConfig({ createIfMissing: true });
    const logger = flags.json ? null : createLogger(config);

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

    const service = new TaskService({ config });
    const task = service.create({
      title: flags.title,
      bodyMd: body,
      status: flags.status as TaskStatus,
      // New scheduling fields
      scheduledStart: flags['scheduled-start'],
      scheduledEnd: flags['scheduled-end'],
      isAllDay: flags['all-day'],
      // Deprecated fields (kept for backward compatibility)
      scheduledOn: flags['scheduled-on'] ?? undefined,
      startTime: flags.start,
      endDate: flags['end-date'],
      endTime: flags.end,
      duration: flags.duration,
      labels: flags.label ?? [],
      projectIds: flags.project ?? []
    });

    if (logger) {
      logger.info({ taskId: task.id, title: task.title }, 'Created task');
    }

    if (flags.json) {
      this.log(JSON.stringify({ task }, null, 2));
      return;
    }

    this.log(`Created task #${task.id}`);
  }
}
