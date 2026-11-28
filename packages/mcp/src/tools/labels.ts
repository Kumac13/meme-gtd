import { z } from 'zod';
import { defineTool, requireTask, type ToolContext } from '../toolkit.js';
import { Label, id } from '../schemas.js';

export function registerLabelTools(context: ToolContext): void {
  defineTool(context, {
    name: 'list_labels',
    title: 'List labels',
    description: 'Use this when you need the existing labels with their IDs and how many memos, tasks and articles carry each. Labels cannot be created or deleted through these tools.',
    kind: 'read',
    input: {},
    output: { labels: z.array(Label) },
    run: async (_args, api) => ({ labels: await api.get('/api/labels') }),
  });

  defineTool(context, {
    name: 'assign_label_to_issue',
    title: 'Assign label',
    description: 'Use this when the user asks to put an existing label on a task, memo or article. Takes the label\'s ID from list_labels, not its name. Assigning a label the issue already has changes nothing.',
    kind: 'create',
    input: { issueId: id('issue (task, memo or article)'), labelId: id('label') },
    output: { assigned: z.literal(true), issueId: z.number().int(), labelId: z.number().int() },
    run: async (args, api) => {
      await api.post(`/api/issues/${args.issueId}/labels`, { labelId: args.labelId });
      return { assigned: true, issueId: args.issueId, labelId: args.labelId };
    },
  });

  defineTool(context, {
    name: 'remove_label_from_issue',
    title: 'Remove label from task',
    description: 'Use this when the user asks to take a label off a task. Only works for tasks. Takes the label\'s ID from list_labels. The label itself is not deleted.',
    kind: 'delete',
    input: { taskId: id('task'), labelId: id('label') },
    output: { removed: z.literal(true), taskId: z.number().int(), labelId: z.number().int() },
    run: async (args, api) => {
      await requireTask(api, args.taskId);
      await api.delete(`/api/issues/${args.taskId}/labels/${args.labelId}`);
      return { removed: true, taskId: args.taskId, labelId: args.labelId };
    },
  });
}
