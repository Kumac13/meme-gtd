import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { LinkService, MemoService, TaskService } from 'meme-gtd-core';
import { loadBodyFromFile } from '../../lib/io.js';
import { promptEditor } from '../../lib/editor.js';
import { detectLegacyFlags, formatLegacyFlagError } from '../../lib/legacy-flags.js';

export default class MemoPromote extends Command {
  static summary = 'Promote a memo to a task';
  static description =
    'Convert a memo into an actionable task, optionally rewriting the body, labels, or status during promotion.';
  static usage = [
    '<%= command.id %> <memoId> --title <text> [--body <text> | --body-file <path>]',
    '<%= command.id %> <memoId> --title <text> [--label <name> ...] [--status <state>] [--json]'
  ];
  static examples = [
    '$ mgtd memo promote 21 --title "Ship onboarding email" --status next',
    '$ mgtd memo promote 8 --title "Draft test plan" --body-file plan.md --label qa',
    '$ mgtd memo promote 5 --title "Kickoff meeting" --json'
  ];

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    title: Flags.string({
      char: 't',
      summary: 'Task title',
      description: 'Sets the title of the new task created from the memo.',
      required: true
    }),
    body: Flags.string({
      char: 'b',
      summary: 'Override task body inline',
      description: 'Provide Markdown content that will populate the task body.'
    }),
    'body-file': Flags.string({
      char: 'f',
      summary: 'Override task body from file/stdin',
      description: 'Use "-" for stdin or pass a file with Markdown content.'
    }),
    label: Flags.string({
      char: 'l',
      summary: 'Labels to copy to the task',
      description: 'Apply one or more labels to the resulting task.',
      multiple: true
    }),
    status: Flags.string({
      char: 's',
      summary: 'Initial task status',
      description: 'Set the status that the new task should start in. Default: inbox',
      options: ['inbox', 'someday', 'open', 'next', 'waiting', 'scheduled'],
      default: 'inbox'
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Return the promoted memo and new task ID as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const legacyResult = detectLegacyFlags({
      '--bodyFile': '--body-file'
    });

    if (legacyResult.detected) {
      this.error(formatLegacyFlagError(legacyResult));
    }

    const { args, flags } = await this.parse(MemoPromote);
    const { config } = await loadConfig({ createIfMissing: true });
    const memoService = new MemoService({ config });
    const taskService = new TaskService({ config });
    const linkService = new LinkService({ config });

    const preview = memoService.promotePreview(args.id);

    let body = flags.body;
    if (!body && flags['body-file']) {
      body = await loadBodyFromFile(flags['body-file']);
    }
    if (!body) {
      body = await promptEditor(preview.bodyMd);
    }

    const labels = flags.label ?? preview.labels;

    const task = taskService.create({
      title: flags.title,
      bodyMd: body,
      status: flags.status as 'inbox' | 'someday' | 'open' | 'next' | 'waiting' | 'scheduled',
      labels,
      projectIds: preview.projectIds,
    });

    for (const link of preview.linkedIssues) {
      const allowedTypes = ['parent', 'child', 'relates', 'derived_from'] as const;
      const linkType = allowedTypes.find((t) => t === link.linkType);
      if (!linkType) continue;
      const sourceId = link.direction === 'outgoing' ? task.id : link.targetIssue.id;
      const targetId = link.direction === 'outgoing' ? link.targetIssue.id : task.id;
      linkService.create(sourceId, targetId, linkType);
    }

    linkService.create(task.id, args.id, 'derived_from');

    if (flags.json) {
      this.log(JSON.stringify({ memoId: args.id, taskId: task.id }, null, 2));
      return;
    }

    this.log(`Promoted memo #${args.id} to task #${task.id}`);
  }
}
