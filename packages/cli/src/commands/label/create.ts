import { Command, Flags, Args } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { LabelService } from 'meme-gtd-core';

export default class LabelCreate extends Command {
  static summary = 'Create a new label';
  static description =
    'Create a new label that can be assigned to both memos and tasks. Label names must be unique.';
  static usage = ['<%= command.id %> <name> [--description <text>] [--json]'];
  static examples = [
    '$ mgtd label create bug',
    '$ mgtd label create feature --description "New features"',
    '$ mgtd label create urgent --json'
  ];

  static args = {
    name: Args.string({
      description: 'Label name (case-sensitive, unique)',
      required: true
    })
  };

  static flags = {
    description: Flags.string({
      char: 'd',
      summary: 'Label description',
      description: 'Optional description for the label'
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the created label as JSON object.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(LabelCreate);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new LabelService({ config });

    try {
      const label = service.create(args.name, flags.description);

      if (flags.json) {
        this.log(JSON.stringify(label, null, 2));
        return;
      }

      this.log(`Label '${args.name}' created`);
    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }
  }
}
