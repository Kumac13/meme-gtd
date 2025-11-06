import { Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskList extends Command {
  static summary = 'List tasks';
  static description =
    'Show task items, optionally filtered by status, label, full-text search, or bookmark state.';
  static usage = [
    '<%= command.id %> [--status <state>] [--label <name>] [--search <query>] [--bookmarked] [--order <asc|desc>] [--limit <n>] [--json]'
  ];
  static examples = [
    '$ mgtd task list',
    '$ mgtd task list --status next',
    '$ mgtd task list --label urgent --order asc',
    '$ mgtd task list --label bug,enhancement',
    '$ mgtd task list --label bug --status open',
    '$ mgtd task list --search "bug" --limit 10',
    '$ mgtd task list --bookmarked --json'
  ];

  static flags = {
    status: Flags.string({
      char: 's',
      summary: 'Filter by status',
      description: 'Return only tasks with the specified status.',
      options: ['open', 'next', 'waiting', 'scheduled', 'done', 'canceled']
    }),
    label: Flags.string({
      char: 'l',
      summary: 'Filter by label name(s)',
      description: 'Filter tasks by label. Supports comma-separated values for OR logic (e.g., bug,enhancement).'
    }),
    search: Flags.string({
      summary: 'Search tasks by title and body',
      description: 'Search tasks by both title and body using free-text partial matching (SQLite FTS5). Supports multi-word queries with implicit AND logic.'
    }),
    'search-title': Flags.string({
      summary: 'Search tasks by title only',
      description: 'Search tasks by title field only using free-text partial matching (SQLite FTS5).'
    }),
    'search-body': Flags.string({
      summary: 'Search tasks by body only',
      description: 'Search tasks by body field only using free-text partial matching (SQLite FTS5).'
    }),
    limit: Flags.integer({
      char: 'n',
      summary: 'Maximum number of rows',
      description: 'Restrict the number of results to the provided value.'
    }),
    order: Flags.string({
      char: 'o',
      summary: 'Sort direction',
      description: 'Choose whether to display most recently updated tasks first or last.',
      options: ['asc', 'desc'],
      default: 'desc'
    }),
    bookmarked: Flags.boolean({
      summary: 'Show only bookmarked tasks',
      description: 'Filter the list to show only bookmarked tasks.',
      default: false
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the task list as JSON so it can be piped to tools like jq.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(TaskList);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    // Parse comma-separated labels
    const labels = flags.label
      ? flags.label.split(',').map(l => l.trim()).filter(Boolean)
      : undefined;

    const tasks = service.list({
      status: flags.status as any,
      labels,
      search: flags.search,
      searchTitle: flags['search-title'],
      searchBody: flags['search-body'],
      limit: flags.limit,
      order: flags.order as 'asc' | 'desc' | undefined,
      isBookmarked: flags.bookmarked ? true : undefined
    });

    if (flags.json) {
      this.log(JSON.stringify({ tasks }, null, 2));
      return;
    }

    if (tasks.length === 0) {
      this.log('No tasks found.');
      return;
    }

    for (const task of tasks) {
      const indicator = task.isBookmarked ? '★' : ' ';
      const statusBadge = `[${task.status}]`;
      const labelsStr = task.labels && task.labels.length > 0 ? `[${task.labels.join(', ')}]` : '';
      this.log(`${indicator} #${task.id}\t${labelsStr}\t${task.title}\t${statusBadge}\t${task.updatedAt}`);
    }
  }
}
