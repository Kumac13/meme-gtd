import { Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoList extends Command {
  static summary = 'List captured memos';
  static description =
    'Show captured memo items, optionally filtered by label, full-text search, or update order.';
  static usage = [
    '<%= command.id %> [--label <name>] [--search <query>] [--order <asc|desc>] [--limit <n>] [--json]'
  ];
  static examples = [
    '$ mgtd memo list',
    '$ mgtd memo list --label inbox --order asc',
    '$ mgtd memo list --label idea,meeting-notes',
    '$ mgtd memo list --bookmarked',
    '$ mgtd memo list --search "next actions" --limit 5 --json'
  ];

  static flags = {
    label: Flags.string({
      char: 'l',
      summary: 'Filter by label name(s)',
      description: 'Filter memos by label. Supports comma-separated values for OR logic (e.g., idea,meeting-notes).'
    }),
    search: Flags.string({
      char: 's',
      summary: 'Filter using full-text search',
      description: 'Runs the query against memo Markdown content using SQLite FTS.'
    }),
    limit: Flags.integer({
      char: 'n',
      summary: 'Maximum number of rows',
      description: 'Restrict the number of results to the provided value.'
    }),
    order: Flags.string({
      char: 'o',
      summary: 'Sort direction',
      description: 'Choose whether to display most recently updated memos first or last.',
      options: ['asc', 'desc'],
      default: 'desc'
    }),
    bookmarked: Flags.boolean({
      summary: 'Show only bookmarked memos',
      description: 'Filter the list to show only bookmarked memos.',
      default: false
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the memo list as JSON so it can be piped to tools like jq.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(MemoList);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    // Parse comma-separated labels
    const labels = flags.label
      ? flags.label.split(',').map(l => l.trim()).filter(Boolean)
      : undefined;

    const memos = service.list({
      labels,
      search: flags.search,
      limit: flags.limit,
      order: flags.order as 'asc' | 'desc' | undefined,
      isBookmarked: flags.bookmarked ? true : undefined
    });

    if (flags.json) {
      this.log(JSON.stringify({ memos }, null, 2));
      return;
    }

    if (memos.length === 0) {
      this.log('No memos found.');
      return;
    }

    for (const memo of memos) {
      const indicator = memo.isBookmarked ? '★' : ' ';
      const labelsStr = memo.labels && memo.labels.length > 0 ? `[${memo.labels.join(', ')}]` : '';
      const bodyPreview = memo.bodyMd.split('\n')[0].slice(0, 80);
      this.log(`${indicator} #${memo.id}\t${labelsStr}\t${bodyPreview}\t${memo.updatedAt}`);
    }
  }
}
