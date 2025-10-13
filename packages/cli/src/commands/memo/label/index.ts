import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoLabelIndex extends Command {
  static summary = 'List memo labels';
  static description =
    'Show labels currently attached to a memo. Use the add/remove/set subcommands to update assignments.';
  static usage = ['<%= command.id %> <memoId> [--json]'];
  static examples = ['$ mgtd memo label 17', '$ mgtd memo label 17 --json'];

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the memo labels as JSON.',
      default: false
    })
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
