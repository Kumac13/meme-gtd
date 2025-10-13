import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';
import { loadBodyFromFile } from '../../lib/io.js';
import { promptEditor } from '../../lib/editor.js';

export default class MemoEdit extends Command {
  static description = 'Edit an existing memo';

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    body: Flags.string({ description: 'Replace memo body' }),
    bodyFile: Flags.string({ description: 'Load body from file or - for stdin' }),
    addLabel: Flags.string({ description: 'Labels to add', multiple: true }),
    removeLabel: Flags.string({ description: 'Labels to remove', multiple: true }),
    setLabel: Flags.string({ description: 'Replace labels with provided list', multiple: true }),
    project: Flags.integer({ description: 'Replace project assignment with given IDs', multiple: true }),
    json: Flags.boolean({ description: 'Output JSON', default: false })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoEdit);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new MemoService({ config });

    let body: string | undefined = flags.body;

    if (!body && flags.bodyFile) {
      body = await loadBodyFromFile(flags.bodyFile);
    }

    if (flags.body === undefined && flags.bodyFile === undefined && !flags.setLabel && !flags.addLabel && !flags.removeLabel && !flags.project) {
      // If no flags provided, open editor with existing content
      const memo = service.show(args.id);
      body = await promptEditor(memo.bodyMd);
    }

    const updateResult = service.edit({
      id: args.id,
      bodyMd: body,
      addLabels: flags.addLabel,
      removeLabels: flags.removeLabel,
      projectIds: flags.project
    });

    if (flags.setLabel) {
      service.setLabels(args.id, flags.setLabel);
    }

    if (flags.json) {
      this.log(JSON.stringify({ memo: updateResult }, null, 2));
      return;
    }

    this.log(`Updated memo #${updateResult.id}`);
  }
}
