import { Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { LinkService } from 'meme-gtd-core';

export default class LinkAdd extends Command {
  static summary = 'Create a link between two tasks or memos';
  static description =
    'Create a relationship between two issues (tasks or memos). Supports parent, child, relates, and derived_from link types.';
  static usage = ['<%= command.id %> --type <type> --source <id> --target <id> [--json]'];
  static examples = [
    '$ mgtd link add --type parent --source 5 --target 10',
    '$ mgtd link add -t child -s 10 -T 5',
    '$ mgtd link add --type relates --source 3 --target 8',
    '$ mgtd link add --type derived_from --source 15 --target 2 --json'
  ];

  static flags = {
    type: Flags.string({
      char: 't',
      summary: 'Link type',
      description: 'Type of relationship: parent, child, relates, derived_from',
      required: true,
      options: ['parent', 'child', 'relates', 'derived_from']
    }),
    source: Flags.integer({
      char: 's',
      summary: 'Source issue ID',
      description: 'ID of the source issue (task or memo)',
      required: true
    }),
    target: Flags.integer({
      char: 'T',
      summary: 'Target issue ID',
      description: 'ID of the target issue (task or memo)',
      required: true
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the created link as JSON object',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(LinkAdd);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new LinkService({ config });

    try {
      const link = service.create(
        flags.source,
        flags.target,
        flags.type as 'parent' | 'child' | 'relates' | 'derived_from'
      );

      if (flags.json) {
        this.log(JSON.stringify(link, null, 2));
        return;
      }

      this.log(
        `Link created: #${link.id} (${link.sourceIssueId} --${link.linkType}--> ${link.targetIssueId})`
      );
    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }
  }
}
