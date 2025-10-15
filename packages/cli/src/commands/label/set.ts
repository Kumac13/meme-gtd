import { Command, Flags, Args } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { LabelService } from 'meme-gtd-core';
import { nowIso } from 'meme-gtd-shared';

export default class LabelSet extends Command {
  static summary = 'Assign a label to an issue';
  static description =
    'Assign a label to an issue (memo or task). The operation is idempotent - assigning the same label multiple times has no effect.';
  static usage = ['<%= command.id %> <issue-id> <label-id> [--json]'];
  static examples = [
    '$ mgtd label set 5 2',
    '$ mgtd label set 10 1 --json'
  ];

  static args = {
    issueId: Args.integer({
      description: 'Issue ID (memo or task)',
      required: true
    }),
    labelId: Args.integer({
      description: 'Label ID',
      required: true
    })
  };

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the assignment details as JSON object.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(LabelSet);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new LabelService({ config });

    try {
      service.assignToIssue(args.issueId, args.labelId);

      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              issue_id: args.issueId,
              label_id: args.labelId,
              assigned_at: nowIso()
            },
            null,
            2
          )
        );
        return;
      }

      this.log(`Label assigned to issue #${args.issueId}`);
    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }
  }
}
