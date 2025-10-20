import { Command, Flags, Args } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { LinkService } from 'meme-gtd-core';
import type { Link } from 'meme-gtd-shared';

interface LinkWithDirection extends Link {
  direction: 'outgoing' | 'incoming';
}

export default class LinkList extends Command {
  static summary = 'List all links for a specific issue';
  static description =
    'Display all links (relationships) associated with a task or memo. Shows both outgoing and incoming links.';
  static usage = ['<%= command.id %> <issue-id> [--type <type>] [--json]'];
  static examples = [
    '$ mgtd link list 5',
    '$ mgtd link list 10 --type parent',
    '$ mgtd link list 3 -t relates -j'
  ];

  static args = {
    'issue-id': Args.integer({
      description: 'ID of the issue (task or memo) to list links for',
      required: true
    })
  };

  static flags = {
    type: Flags.string({
      char: 't',
      summary: 'Filter by link type',
      description: 'Only show links of this type: parent, child, relates, derived_from',
      options: ['parent', 'child', 'relates', 'derived_from']
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the links as JSON array with direction field',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(LinkList);
    const issueId = args['issue-id'];
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new LinkService({ config });

    try {
      const filters = flags.type
        ? { type: flags.type as 'parent' | 'child' | 'relates' | 'derived_from' }
        : undefined;

      const links = service.list(issueId, filters);

      // Add direction to each link
      const linksWithDirection: LinkWithDirection[] = links.map((link) => ({
        ...link,
        direction: link.sourceIssueId === issueId ? 'outgoing' : 'incoming'
      }));

      if (flags.json) {
        this.log(JSON.stringify(linksWithDirection, null, 2));
        return;
      }

      // Human-readable output
      if (linksWithDirection.length === 0) {
        this.log(`No links found for issue #${issueId}`);
        return;
      }

      this.log(`Links for issue #${issueId}:\n`);

      // Calculate column widths for alignment
      const maxLinkIdWidth = Math.max(...linksWithDirection.map(l => String(l.id).length));
      const maxTypeWidth = Math.max(...linksWithDirection.map(l => l.linkType.length));

      for (const link of linksWithDirection) {
        const linkIdPadded = String(link.id).padStart(maxLinkIdWidth);
        const typePadded = link.linkType.padEnd(maxTypeWidth);

        if (link.direction === 'outgoing') {
          this.log(
            `  #${linkIdPadded}  #${link.sourceIssueId} --${typePadded}--> #${link.targetIssueId}`
          );
        } else {
          this.log(
            `  #${linkIdPadded}  #${link.targetIssueId} <--${typePadded}-- #${link.sourceIssueId}`
          );
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }
  }
}
