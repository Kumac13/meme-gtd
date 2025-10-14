import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';
import { loadBodyFromFile } from '../../../lib/io.js';
import { promptEditor } from '../../../lib/editor.js';
import { detectLegacyFlags, formatLegacyFlagError } from '../../../lib/legacy-flags.js';

export default class TaskCommentEdit extends Command {
  static summary = 'Edit an existing task comment';
  static description =
    'Update a task comment by supplying new Markdown inline, from a file, or by editing the existing body.';
  static usage = [
    '<%= command.id %> <taskId> <commentId> [--body <text> | --body-file <path>] [--json]'
  ];
  static examples = [
    '$ mgtd task comment edit 1 3 --body "updated comment"',
    '$ mgtd task comment edit 2 1 --body-file patch.md'
  ];

  static args = {
    taskId: Args.integer({ description: 'Task ID', required: true }),
    commentId: Args.integer({ description: 'Comment ID', required: true })
  } as const;

  static flags = {
    body: Flags.string({
      char: 'b',
      summary: 'Inline replacement body',
      description: 'Provide the full comment Markdown directly.'
    }),
    'body-file': Flags.string({
      char: 'f',
      summary: 'Load replacement body from file/stdin',
      description: 'Use "-" to read from stdin or pass a Markdown file path.'
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Return the updated comment record as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    // 旧フラグ検出
    const legacyResult = detectLegacyFlags({
      '--bodyFile': '--body-file'
    });

    if (legacyResult.detected) {
      this.error(formatLegacyFlagError(legacyResult));
    }

    const { args, flags } = await this.parse(TaskCommentEdit);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    let body = flags.body ?? '';
    if (!body && flags['body-file']) {
      body = await loadBodyFromFile(flags['body-file']);
    }
    if (!body) {
      const comments = service.listComments(args.taskId);
      const existing = comments.find((c) => c.id === args.commentId);
      if (!existing) {
        this.error(`Comment #${args.commentId} not found for task #${args.taskId}`);
      }
      body = await promptEditor(existing!.bodyMd);
    }

    const updated = service.updateComment(args.commentId, body);

    if (flags.json) {
      this.log(JSON.stringify({ comment: updated }, null, 2));
      return;
    }

    this.log(`Updated comment #${updated.id}`);
  }
}
