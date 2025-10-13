import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoLabelAdd extends Command {
  static summary = 'Add labels to a memo';
  static description =
    'Attach one or more labels to a memo. Existing labels remain untouched.';
  static usage = ['<%= command.id %> <memoId> --label <name> [--label <name> ...] [--json]'];
  static examples = [
    '$ mgtd memo label add 9 --label inbox',
    '$ mgtd memo label add 9 --label backlog --label review --json'
  ];

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    label: Flags.string({
      summary: 'Labels to append',
      description: 'Provide one or more labels to add to the memo.',
      multiple: true,
      required: true
    }),
    json: Flags.boolean({
      summary: 'Return JSON output',
      description: 'Emit the updated memo and labels as JSON.',
      default: false
    })
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
