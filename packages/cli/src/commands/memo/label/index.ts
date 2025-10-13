import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoLabelIndex extends Command {
  static description = 'List labels assigned to a memo';

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    json: Flags.boolean({ description: 'Output JSON', default: false })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoLabelIndex);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });
    const labels = service.listLabels(args.id);

    if (flags.json) {
      this.log(JSON.stringify({ memoId: args.id, labels }, null, 2));
      return;
    }

    if (labels.length === 0) {
      this.log(`Memo #${args.id} has no labels.`);
      return;
    }

    this.log(labels.join(', '));
  }
}
