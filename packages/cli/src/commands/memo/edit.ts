import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { MemoService } from 'meme-gtd-core';
import { loadBodyFromFile } from '../../lib/io.js';
import { promptEditor } from '../../lib/editor.js';

export default class MemoEdit extends Command {
  static summary = 'Update memo content or metadata';
  static description =
    'Revise a memo using inline text, file input, or the editor. You can also adjust labels and project links.';
  static usage = [
    '<%= command.id %> <memoId> [--body <text> | --body-file <path>]',
    '<%= command.id %> <memoId> [--add-label <name> ...] [--remove-label <name> ...]',
    '<%= command.id %> <memoId> [--project <id> ...] [--json]'
  ];
  static examples = [
    '$ mgtd memo edit 12 --body-file scratch.md',
    '$ mgtd memo edit 7 --add-label triage --remove-label backlog',
    '$ mgtd memo edit 4 --project 3 --project 8 --json'
  ];

  static args = {
    id: Args.integer({ description: 'Memo ID', required: true })
  } as const;

  static flags = {
    body: Flags.string({
      char: 'b',
      summary: 'Replace memo text inline',
      description: 'Provide the full memo Markdown content as a string.'
    }),
    bodyFile: Flags.string({
      char: 'f',
      summary: 'Replace memo text from file/stdin',
      description: 'Use "-" to read from stdin or pass a file path.'
    }),
    addLabel: Flags.string({
      char: 'a',
      summary: 'Labels to add',
      description: 'Append one or more labels without removing existing ones.',
      multiple: true
    }),
    removeLabel: Flags.string({
      char: 'r',
      summary: 'Labels to remove',
      description: 'Drop one or more labels from the memo.',
      multiple: true
    }),
    setLabel: Flags.string({
      char: 's',
      summary: 'Overwrite label set',
      description: 'Replace the memo labels with this exact list.',
      multiple: true
    }),
    project: Flags.integer({
      char: 'p',
      summary: 'Set related project IDs',
      description: 'Override the memo project links with the provided IDs.',
      multiple: true
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Emit the updated memo payload as JSON.',
      default: false
    })
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
