import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoLabelRemove extends Command {
  static summary = 'Remove memo labels';
  static description =
    'Detach one or more labels from a memo. Remaining labels are left untouched.';
  static usage = ['<%= command.id %> <memoId> --label <name> [--label <name> ...] [--json]'];
  static examples = [
    '$ mgtd memo label remove 12 --label backlog',
    '$ mgtd memo label remove 12 --label backlog --label weekly --json'
  ];

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    label: Flags.string({
      char: 'l',
      summary: 'Labels to remove',
      description: 'Provide one or more labels that should be removed from the memo.',
      multiple: true,
      required: true
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the updated memo and label list in JSON format.',
      default: false
    })
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
