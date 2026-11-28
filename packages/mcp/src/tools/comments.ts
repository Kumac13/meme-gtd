import { z } from 'zod';
import type { Api } from '../api.js';
import { defineTool, ToolInputError, type ToolContext } from '../toolkit.js';
import { Comment, id } from '../schemas.js';

const commentsOutput = { comments: z.array(Comment) };
const commentOutput = { comment: Comment };
const body = z.string().min(1).describe('Comment text in Markdown.');
const MENTION_NOTE = 'Writing "#123" in the text turns it into a link to issue 123 and also creates a "relates" link from the task to it.';

/** コメントがそのタスクのものであることを確認する（API はコメント ID だけで更新・削除するため）。 */
async function requireTaskComment(api: Api, taskId: number, commentId: number): Promise<void> {
  const comments = (await api.get(`/api/tasks/${taskId}/comments`)) as Array<{ id: number }>;
  if (!comments.some(comment => comment.id === commentId)) {
    throw new ToolInputError(`Comment #${commentId} does not belong to task #${taskId}. Nothing was changed. Use list_task_comments to find the right comment ID.`);
  }
}

export function registerCommentTools(context: ToolContext): void {
  defineTool(context, {
    name: 'list_task_comments',
    title: 'List task comments',
    description: 'Use this when you need the comments on a task, oldest first. Comments often hold the follow-up notes and decisions for the task.',
    kind: 'read',
    input: { taskId: id('task') },
    output: commentsOutput,
    run: async (args, api) => ({ comments: await api.get(`/api/tasks/${args.taskId}/comments`) }),
  });

  defineTool(context, {
    name: 'create_task_comment',
    title: 'Add task comment',
    description: `Use this when the user asks to add a note, progress report or decision to a task. Adds one comment and returns it. ${MENTION_NOTE} Not safe to retry blindly: a retry adds a second comment.`,
    kind: 'create',
    input: { taskId: id('task'), bodyMd: body },
    output: commentOutput,
    run: async (args, api) => ({ comment: await api.post(`/api/tasks/${args.taskId}/comments`, { bodyMd: args.bodyMd }) }),
  });

  defineTool(context, {
    name: 'update_task_comment',
    title: 'Edit task comment',
    description: `Use this when the user asks to rewrite an existing comment on a task. Replaces the whole comment text and returns the saved comment. The comment must belong to the given task. ${MENTION_NOTE}`,
    kind: 'update',
    input: { taskId: id('task'), commentId: id('comment'), bodyMd: body },
    output: commentOutput,
    run: async (args, api) => {
      await requireTaskComment(api, args.taskId, args.commentId);
      return { comment: await api.patch(`/api/tasks/${args.taskId}/comments/${args.commentId}`, { bodyMd: args.bodyMd }) };
    },
  });

  defineTool(context, {
    name: 'delete_task_comment',
    title: 'Delete task comment',
    description: 'Use this only when the user explicitly asks to delete a comment from a task. The comment must belong to the given task. It cannot be restored through these tools.',
    kind: 'delete',
    input: { taskId: id('task'), commentId: id('comment') },
    output: { deleted: z.literal(true), taskId: z.number().int(), commentId: z.number().int() },
    run: async (args, api) => {
      await requireTaskComment(api, args.taskId, args.commentId);
      await api.delete(`/api/tasks/${args.taskId}/comments/${args.commentId}`);
      return { deleted: true, taskId: args.taskId, commentId: args.commentId };
    },
  });

  defineTool(context, {
    name: 'list_memo_comments',
    title: 'List memo comments',
    description: 'Use this when you need the comments on a memo, oldest first. Memo comments are read-only through these tools.',
    kind: 'read',
    input: { memoId: id('memo') },
    output: commentsOutput,
    run: async (args, api) => ({ comments: await api.get(`/api/memos/${args.memoId}/comments`) }),
  });

  defineTool(context, {
    name: 'list_article_comments',
    title: 'List article comments',
    description: 'Use this when you need the comments on an article, oldest first. Article comments are read-only through these tools.',
    kind: 'read',
    input: { articleId: id('article') },
    output: commentsOutput,
    run: async (args, api) => ({ comments: await api.get(`/api/articles/${args.articleId}/comments`) }),
  });
}
