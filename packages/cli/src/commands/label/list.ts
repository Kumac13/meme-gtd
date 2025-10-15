import { Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { LabelService } from 'meme-gtd-core';

export default class LabelList extends Command {
  static summary = 'List all labels';
  static description =
    'Display all labels in the system. Labels can be assigned to both memos and tasks.';
  static usage = ['<%= command.id %> [--json]'];
  static examples = ['$ mgtd label list', '$ mgtd label list --json'];

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the label list as JSON array.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(LabelList);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new LabelService({ config });
    const labels = service.list();

    if (flags.json) {
      this.log(JSON.stringify(labels, null, 2));
      return;
    }

    if (labels.length === 0) {
      this.log('No labels found');
      return;
    }

    for (const label of labels) {
      this.log(`${label.id}\t${label.name}`);
    }
  }
}
