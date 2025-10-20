import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { LinkService } from 'meme-gtd-core';
import * as readline from 'readline';

export default class LinkRemove extends Command {
  static summary = 'Remove a link between tasks or memos';
  static description =
    'Delete a relationship link by its ID. Unless --yes is supplied, you will receive a confirmation prompt.';
  static usage = ['<%= command.id %> <link-id> [--yes] [--json]'];
  static examples = [
    '$ mgtd link remove 5',
    '$ mgtd link remove 10 --yes',
    '$ mgtd link remove 3 -y -j'
  ];

  static args = {
    'link-id': Args.integer({
      description: 'ID of the link to remove',
      required: true
    })
  } as const;

  static flags = {
    yes: Flags.boolean({
      char: 'y',
      summary: 'Skip confirmation prompt',
      description: 'Force deletion in non-interactive settings',
      default: false
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the result as JSON object',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(LinkRemove);
    const linkId = args['link-id'];
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new LinkService({ config });

    // Get link for preview (also validates it exists)
    let link;
    try {
      link = service.getById(linkId);
    } catch (error) {
      if (flags.json) {
        this.log(
          JSON.stringify({
            deleted: false,
            linkId,
            reason: error instanceof Error ? error.message : 'Unknown error'
          })
        );
        return;
      }
      this.error(error instanceof Error ? error.message : 'Unknown error', { exit: 1 });
    }

    // Non-interactive mode: --yes flag provided
    if (flags.yes) {
      service.remove(linkId);
      if (flags.json) {
        this.log(JSON.stringify({ deleted: true, linkId }));
      } else {
        this.log(`Link #${linkId} deleted`);
      }
      return;
    }

    // JSON mode requires --yes flag
    if (flags.json) {
      this.log(
        JSON.stringify({
          deleted: false,
          linkId,
          reason: 'JSON mode requires --yes flag for confirmation'
        })
      );
      return;
    }

    // Check if TTY available
    if (!process.stdin.isTTY) {
      this.error('Cannot prompt for confirmation. Please use --yes flag to confirm deletion.', {
        exit: 1
      });
    }

    // Interactive mode: prompt user
    const preview = `#${link.sourceIssueId} --${link.linkType}--> #${link.targetIssueId}`;
    const confirmed = await this.promptConfirmation(linkId, preview);

    if (confirmed) {
      service.remove(linkId);
      this.log(`Link #${linkId} deleted`);
    } else {
      this.log('Cancelled');
    }
  }

  private async promptConfirmation(linkId: number, preview: string): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      // Handle Ctrl+C
      const sigintHandler = () => {
        rl.close();
        this.log('\nCancelled');
        process.exit(130);
      };
      process.once('SIGINT', sigintHandler);

      rl.question(`Delete link #${linkId} (${preview})? (y/N): `, (answer) => {
        process.removeListener('SIGINT', sigintHandler);
        rl.close();

        const normalized = answer.toLowerCase().trim();

        if (['y', 'yes'].includes(normalized)) {
          resolve(true);
        } else if (['n', 'no', ''].includes(normalized)) {
          resolve(false);
        } else {
          this.log(`Invalid input: "${answer}". Please answer 'y' or 'n'.`);
          this.log('Cancelled');
          resolve(false);
        }
      });
    });
  }
}
