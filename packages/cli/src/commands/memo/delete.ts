import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoDelete extends Command {
  static summary = 'Soft-delete a memo';
  static description =
    'Mark a memo as deleted. Unless --yes is supplied you will receive a confirmation hint.';
  static usage = ['<%= command.id %> <memoId> [--yes]'];
  static examples = ['$ mgtd memo delete 17 --yes'];

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    yes: Flags.boolean({
      char: 'y',
      summary: 'Skip confirmation prompt',
      description: 'Force deletion in non-interactive settings.',
      default: false
    })
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
