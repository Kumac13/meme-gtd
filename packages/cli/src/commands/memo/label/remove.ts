import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoLabelRemove extends Command {
  static description = 'Remove labels from a memo';

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    label: Flags.string({ description: 'Labels to remove', multiple: true, required: true }),
    json: Flags.boolean({ description: 'Output JSON', default: false })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoLabelRemove);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    const memo = service.edit({ id: args.id, removeLabels: flags.label });

    if (flags.json) {
      this.log(JSON.stringify({ memo, labels: service.listLabels(args.id) }, null, 2));
      return;
    }
    this.log(`Labels removed from memo #${memo.id}`);
  }
}
