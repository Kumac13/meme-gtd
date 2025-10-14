import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoLabelSet extends Command {
  static summary = 'Replace memo labels';
  static description =
    'Overwrite the memo label set with the provided list. Any omitted labels will be removed.';
  static usage = ['<%= command.id %> <memoId> --label <name> [--label <name> ...] [--json]'];
  static examples = [
    '$ mgtd memo label set 14 --label inbox --label review',
    '$ mgtd memo label set 14 --label focus --json'
  ];

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    label: Flags.string({
      char: 'l',
      summary: 'Labels to use',
      description: 'Provide the complete list of labels that should remain on the memo.',
      multiple: true,
      required: true
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the memo and final label list as JSON.',
      default: false
    })
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
