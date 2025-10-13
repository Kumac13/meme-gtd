import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';
import { loadBodyFromFile } from '../../lib/io.js';
import { promptEditor } from '../../lib/editor.js';

export default class MemoPromote extends Command {
  static description = 'Promote a memo into a task';

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    title: Flags.string({ description: 'Task title', required: true }),
    body: Flags.string({ description: 'Task body override' }),
    bodyFile: Flags.string({ description: 'Load body from file or stdin (-)' }),
    label: Flags.string({ description: 'Labels to apply to the new task', multiple: true }),
    status: Flags.string({ description: 'Initial task status', default: 'open' }),
    json: Flags.boolean({ description: 'Output JSON', default: false })
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
