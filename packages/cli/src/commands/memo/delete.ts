import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoDelete extends Command {
  static description = 'Delete a memo (soft delete)';

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    yes: Flags.boolean({ char: 'y', description: 'Skip confirmation', default: false })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoDelete);
    if (!flags.yes) {
      this.log(`This will delete memo #${args.id}. Re-run with --yes to confirm.`);
      return;
    }

    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });
    service.remove(args.id);
    this.log(`Memo #${args.id} marked as deleted.`);
  }
}
