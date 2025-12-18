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
      summary: 'Search memos by body content',
      description: 'Search memos by body content using free-text partial matching (SQLite FTS5). Supports multi-word queries with implicit AND logic. (Same as --search-body for memos)'
    }),
    'search-body': Flags.string({
      summary: 'Search memos by body only',
      description: 'Search memos by body field only using free-text partial matching (SQLite FTS5). (Same as --search for memos)'
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

    const result = service.list({
      labels,
      search: flags.search,
      searchBody: flags['search-body'],
      limit: flags.limit,
      order: flags.order as 'asc' | 'desc' | undefined,
      isBookmarked: flags.bookmarked ? true : undefined
    });

    if (flags.json) {
      this.log(JSON.stringify({ data: result.data, total: result.total }, null, 2));
      return;
    }

    if (result.data.length === 0) {
      this.log('No memos found.');
      return;
    }

    for (const memo of result.data) {
      const indicator = memo.isBookmarked ? '★' : ' ';
      const labelsStr = memo.labels && memo.labels.length > 0 ? `[${memo.labels.join(', ')}]` : '';
      const bodyPreview = memo.bodyMd.split('\n')[0].slice(0, 80);
      this.log(`${indicator} #${memo.id}\t${labelsStr}\t${bodyPreview}\t${memo.updatedAt}`);
    }
  }
}
