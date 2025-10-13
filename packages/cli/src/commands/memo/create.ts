import { Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';
import { createLogger } from 'meme-gtd-logger';
import { loadBodyFromFile } from '../../lib/io.js';
import { promptEditor } from '../../lib/editor.js';

export default class MemoCreate extends Command {
  static description = 'Create a new memo (Captured item)';

  static flags = {
    body: Flags.string({ description: 'Memo body text (Markdown)' }),
    bodyFile: Flags.string({ description: 'Load body from file or - for stdin' }),
    label: Flags.string({ description: 'Labels to apply', multiple: true }),
    project: Flags.integer({ description: 'Project IDs to attach', multiple: true }),
    json: Flags.boolean({ description: 'Output JSON', default: false })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(MemoCreate);
    const { config } = await loadConfig({ createIfMissing: true });
    const logger = createLogger(config);

    let body = flags.body ?? '';

    if (!body && flags.bodyFile) {
      body = await loadBodyFromFile(flags.bodyFile);
    }

    if (!body) {
      body = await promptEditor();
    }

    if (!body.trim()) {
      this.error('Memo body cannot be empty.');
    }

    const service = new MemoService({ config });
    const memo = service.create({
      bodyMd: body,
      labels: flags.label ?? [],
      projectIds: flags.project ?? []
    });

    logger.info({ memoId: memo.id }, 'Created memo');

    if (flags.json) {
      this.log(JSON.stringify({ memo }, null, 2));
      return;
    }

    this.log(`Created memo #${memo.id}`);
  }
}
