import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

export default class TaskCommentDelete extends Command {
  static summary = 'Delete an existing task comment';
  static description = 'Remove a comment from a task. Confirmation is required unless --yes is supplied.';
  static usage = ['<%= command.id %> <taskId> <commentId> [--yes]'];
  static examples = [
    '$ mgtd task comment delete 1 3 --yes'
  ];

  static args = {
    taskId: Args.integer({ description: 'Task ID', required: true }),
    commentId: Args.integer({ description: 'Comment ID', required: true })
  } as const;

  static flags = {
    yes: Flags.boolean({
      char: 'y',
      summary: 'Skip confirmation prompt',
      description: 'Use in scripts or when you are certain the comment should be removed.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskCommentDelete);
    if (!flags.yes) {
      this.log(`This will delete comment #${args.commentId}. Re-run with --yes to confirm.`);
      return;
    }
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });
    service.deleteComment(args.commentId);
    this.log(`Deleted comment #${args.commentId}`);
  }
}
