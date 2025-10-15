import { Command, Flags, Args } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { LabelService } from 'meme-gtd-core';

export default class LabelDelete extends Command {
  static summary = 'Delete a label';
  static description =
    'Delete a label by name. This will automatically remove the label from all issues (CASCADE delete).';
  static usage = ['<%= command.id %> <name> [--json]'];
  static examples = [
    '$ mgtd label delete obsolete',
    '$ mgtd label delete temp --json'
  ];

  static args = {
    name: Args.string({
      description: 'Label name',
      required: true
    })
  };

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the deletion result as JSON object.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(LabelDelete);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new LabelService({ config });

    try {
      service.delete(args.name);

      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              name: args.name,
              deleted: true
            },
            null,
            2
          )
        );
        return;
      }

      this.log(`Label '${args.name}' deleted`);
    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }
  }
}
