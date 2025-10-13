import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoLabelSet extends Command {
  static description = 'Replace memo labels with the given list';

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    label: Flags.string({ description: 'Labels to set', multiple: true, required: true }),
    json: Flags.boolean({ description: 'Output JSON', default: false })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoLabelSet);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    service.setLabels(args.id, flags.label);
    const memo = service.show(args.id);
    const labels = service.listLabels(args.id);

    if (flags.json) {
      this.log(JSON.stringify({ memo, labels }, null, 2));
      return;
    }
    this.log(`Labels updated for memo #${memo.id}: ${labels.join(', ') || '(none)'}`);
  }
}
