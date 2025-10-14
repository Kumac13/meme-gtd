import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskCommentIndex extends Command {
  static summary = 'Inspect task comments';
  static description = [
    'List the threaded comments attached to a task. Use the dedicated subcommands',
    'to add, edit, or delete comments when you need to make changes.',
    '',
    'Subcommands:',
    '  add     Add a comment body via --body, --body-file, or the editor.',
    '  edit    Update an existing comment (opens the editor if no body is supplied).',
    '  delete  Remove a comment; requires --yes for non-interactive confirmation.',
    '',
    'Run `mgtd task comment <subcommand> --help` for detailed usage.'
  ].join('\n');
  static usage = [
    '<%= command.id %> <taskId> [--json]',
    '<%= command.id %> add <taskId> --body "comment"',
    '<%= command.id %> edit <taskId> <commentId> --body "new body"',
    '<%= command.id %> delete <taskId> <commentId> --yes'
  ];
  static examples = [
    '$ mgtd task comment 42 --json',
    '$ mgtd task comment add 42 --body "Progress update"',
    '$ mgtd task comment edit 42 3 --body-file comment.md',
    '$ mgtd task comment delete 42 3 --yes'
  ];

  static args = {
    id: Args.integer({ description: 'Task ID to inspect', required: true })
  } as const;

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Write the task comments as formatted JSON for downstream tooling.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskCommentIndex);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });
    const comments = service.listComments(args.id);

    if (flags.json) {
      this.log(JSON.stringify({ taskId: args.id, comments }, null, 2));
      return;
    }

    if (comments.length === 0) {
      this.log(`Task #${args.id} has no comments.`);
      return;
    }

    comments.forEach((comment) => {
      this.log(`[${comment.id}] ${comment.bodyMd}`);
    });
  }
}
