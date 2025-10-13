import { Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';

export default class MemoList extends Command {
  static description = 'List memo items';

  static aliases = ['memo'];

  static strict = false;

  static flags = {
    label: Flags.string({ description: 'Filter by label name' }),
    search: Flags.string({ description: 'Full text search query' }),
    limit: Flags.integer({ description: 'Limit number of results' }),
    order: Flags.string({ description: 'Order by updated date asc|desc', options: ['asc', 'desc'], default: 'desc' }),
    json: Flags.boolean({ description: 'Output JSON', default: false })
  } as const;

  async run(): Promise<void> {
    if (this.argv[0] === 'list') {
      this.argv.shift();
    }
    const { flags } = await this.parse(MemoList);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });
    const memos = service.list({
      label: flags.label,
      search: flags.search,
      limit: flags.limit,
      order: flags.order as 'asc' | 'desc' | undefined
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
      this.log(`#${memo.id}\t${memo.bodyMd.split('\n')[0].slice(0, 80)}\t${memo.updatedAt}`);
    }
  }
}
