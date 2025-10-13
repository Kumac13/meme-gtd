import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';
import { createLogger } from 'meme-gtd-logger';
import { loadBodyFromFile } from '../../lib/io.js';
import { promptEditor } from '../../lib/editor.js';

export default class MemoCreate extends Command {
  static summary = 'Capture a new memo';
  static description =
    'Create a memo record in the Captured state. Provide text via flags, stdin, or your configured editor.';
  static usage = [
    '<%= command.id %> [--body <text> | --body-file <path>] [--label <name> ...] [--project <id> ...] [--json]'
  ];
  static examples = [
    '$ mgtd memo create --body "Call back supplier"',
    '$ mgtd memo create --body-file notes.md --label inbox --label vendor',
    '$ mgtd memo create --label backlog --json'
  ];

  static args = {
    body: Args.string({
      description: 'Memo body text provided positionally (quotes recommended for spaces)',
      required: false
    })
  } as const;

  static flags = {
    body: Flags.string({
      char: 'b',
      summary: 'Inline memo content',
      description: 'Provide the memo Markdown directly on the command line.'
    }),
    bodyFile: Flags.string({
      char: 'f',
      summary: 'Load memo content from a file or stdin',
      description: 'Use "-" to read from stdin; otherwise supply a path to a Markdown file.'
    }),
    label: Flags.string({
      char: 'l',
      summary: 'Apply labels',
      description: 'Attach one or more labels during capture.',
      multiple: true
    }),
    project: Flags.integer({
      char: 'p',
      summary: 'Associate projects',
      description: 'Link memo to one or more project IDs.',
      multiple: true
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Return the created memo payload in JSON format.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoCreate);
    const { config } = await loadConfig({ createIfMissing: true });
    const logger = flags.json ? null : createLogger(config);

    let body = flags.body ?? args.body ?? '';

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

    if (logger) {
      logger.info({ memoId: memo.id }, 'Created memo');
    }

    if (flags.json) {
      this.log(JSON.stringify({ memo }, null, 2));
      return;
    }

    this.log(`Created memo #${memo.id}`);
  }
}
