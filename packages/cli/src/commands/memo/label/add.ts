import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoLabelAdd extends Command {
  static description = 'Add labels to a memo';

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    label: Flags.string({ description: 'Labels to add', multiple: true, required: true }),
    json: Flags.boolean({ description: 'Output JSON', default: false })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoLabelAdd);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    const memo = service.edit({ id: args.id, addLabels: flags.label });

    if (flags.json) {
      this.log(JSON.stringify({ memo, labels: service.listLabels(args.id) }, null, 2));
      return;
    }
    this.log(`Labels added to memo #${memo.id}`);
  }
}
