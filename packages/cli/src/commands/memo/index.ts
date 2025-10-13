import { Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';
import { createLogger, getLogger } from 'meme-gtd-logger';

export default class MemoIndex extends Command {
  static description = 'List memo items (Captured)';

  static flags = {
    label: Flags.string({ description: 'Filter by label name' }),
    search: Flags.string({ description: 'Full text search query' }),
    limit: Flags.integer({ description: 'Limit number of results' }),
    order: Flags.string({ description: 'Order by updated date asc|desc', options: ['asc', 'desc'], default: 'desc' }),
    json: Flags.boolean({ description: 'Output JSON', default: false })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(MemoIndex);
    const { config } = await loadConfig({ createIfMissing: true });
    createLogger(config);
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
      this.log('No memos found. Use `mgtd memo create` to capture ideas.');
      return;
    }

    const logger = getLogger();
    logger.debug({ count: memos.length }, 'Listing memos');

    for (const memo of memos) {
      this.log(`#${memo.id}\t${memo.bodyMd.split('\n')[0].slice(0, 80)}\t${memo.updatedAt}`);
    }
  }
}
