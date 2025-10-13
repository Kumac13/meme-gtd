import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';
import { loadBodyFromFile } from '../../lib/io.js';
import { promptEditor } from '../../lib/editor.js';

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
    bodyFile: Flags.string({
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
      description: 'Set the status that the new task should start in.',
      default: 'open'
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Return the promoted memo and new task ID as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoPromote);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    let body = flags.body;
    if (!body && flags.bodyFile) {
      body = await loadBodyFromFile(flags.bodyFile);
    }
    if (!body) {
      const memo = service.show(args.id);
      body = await promptEditor(memo.bodyMd);
    }

    const result = service.promote({
      memoId: args.id,
      title: flags.title,
      bodyMd: body,
      labels: flags.label,
      status: flags.status
    });

    if (flags.json) {
      this.log(JSON.stringify({ memo: result.memo, taskId: result.taskId }, null, 2));
      return;
    }

    this.log(`Promoted memo #${args.id} to task #${result.taskId}`);
  }
}
