import { z } from 'zod';
import { defineTool, csv, projectFilter, ToolInputError, type ToolContext } from '../toolkit.js';
import {
  Task, TaskListItem, TASK_STATUSES, id, localDateTime, dateOnly, pageInput, pageOutput,
  labelsFilter, projectIdsFilter, noProjectFilter,
} from '../schemas.js';

const taskOutput = { task: Task };
const status = z.enum(TASK_STATUSES);
const STATUS_NOTE = 'The API records actualStart when a task moves to "next" and actualEnd when it is closed or canceled.';
const MENTION_NOTE = 'Writing "#123" in the text turns it into a link to issue 123 and also creates a "relates" link to it.';

export function registerTaskTools(context: ToolContext): void {
  defineTool(context, {
    name: 'list_tasks',
    title: 'List tasks',
    description: 'Use this when the user wants to browse or filter tasks by status, label, project, bookmark, schedule or title text. Returns one page with total/limit/offset. scheduledFrom/scheduledTo compare the scheduled date (or the actual start date for unscheduled tasks). Use keyword_search instead to also search comments.',
    kind: 'read',
    input: {
      status: status.optional().describe('Only tasks in this status.'),
      bookmarked: z.boolean().optional().describe('true: only bookmarked tasks. false: only tasks that are not bookmarked.'),
      labels: labelsFilter,
      projectIds: projectIdsFilter,
      noProject: noProjectFilter,
      search: z.string().min(1).optional().describe('Free-text search over task title and body.'),
      scheduledFrom: dateOnly().optional().describe('Only tasks scheduled on or after this date (YYYY-MM-DD).'),
      scheduledTo: dateOnly().optional().describe('Only tasks scheduled on or before this date (YYYY-MM-DD).'),
      ...pageInput(100, 20),
    },
    output: pageOutput(TaskListItem),
    run: (args, api) => api.get('/api/tasks', {
      status: args.status,
      bookmarked: args.bookmarked,
      label: csv(args.labels),
      projectId: projectFilter(args.projectIds, args.noProject),
      search: args.search,
      scheduledFrom: args.scheduledFrom,
      scheduledTo: args.scheduledTo,
      limit: args.limit,
      offset: args.offset,
    }),
  });

  defineTool(context, {
    name: 'get_task',
    title: 'Get task',
    description: 'Use this when you need the full text and current state of one task by its ID, for example before updating it. Fails if the ID is not a task.',
    kind: 'read',
    input: { id: id('task') },
    output: taskOutput,
    run: async (args, api) => ({ task: await api.get(`/api/tasks/${args.id}`) }),
  });

  defineTool(context, {
    name: 'create_task',
    title: 'Create task',
    description: `Use this when the user asks to add a new task. Creates one task and returns it with its new ID. Status defaults to "inbox". ${STATUS_NOTE} ${MENTION_NOTE} Labels, projects and links are attached afterwards with their own tools. Not safe to retry blindly: a retry creates a second task.`,
    kind: 'create',
    input: {
      title: z.string().trim().min(1).describe('Task title.'),
      bodyMd: z.string().optional().describe('Task body in Markdown.'),
      status: status.optional().describe('Initial status (default "inbox").'),
      taskKind: z.enum(['event', 'action']).optional().describe('"action" (default) is something to do; "event" is something that happens at a time.'),
      scheduledStart: localDateTime().optional(),
      scheduledEnd: localDateTime().optional(),
      isAllDay: z.boolean().optional().describe('Whether the schedule is an all-day entry.'),
    },
    output: taskOutput,
    run: async (args, api) => ({ task: await api.post('/api/tasks', args) }),
  });

  defineTool(context, {
    name: 'update_task',
    title: 'Update task',
    description: `Use this when the user asks to change an existing task's title, body, status, kind, schedule or actual times. Only the fields you pass change; a field you pass replaces the stored value entirely (bodyMd is not appended). Pass null to clear a schedule or actual time. ${STATUS_NOTE} ${MENTION_NOTE} Read the task first when editing the body.`,
    kind: 'update',
    input: {
      id: id('task'),
      title: z.string().trim().min(1).optional().describe('New title.'),
      bodyMd: z.string().optional().describe('New body in Markdown. Replaces the whole body.'),
      status: status.optional().describe('New status.'),
      taskKind: z.enum(['event', 'action']).optional(),
      scheduledStart: localDateTime().nullable().optional(),
      scheduledEnd: localDateTime().nullable().optional(),
      isAllDay: z.boolean().optional(),
      actualStart: localDateTime().nullable().optional(),
      actualEnd: localDateTime().nullable().optional(),
    },
    output: taskOutput,
    run: async ({ id: taskId, ...changes }, api) => {
      if (Object.values(changes).every(value => value === undefined)) {
        throw new ToolInputError('Pass at least one field to change.');
      }
      return { task: await api.patch(`/api/tasks/${taskId}`, changes) };
    },
  });

  defineTool(context, {
    name: 'delete_task',
    title: 'Delete task',
    description: 'Use this only when the user explicitly asks to delete a task. The task disappears from lists and search and cannot be restored through these tools. To finish or drop a task instead, use close_task or cancel_task.',
    kind: 'delete',
    input: { id: id('task') },
    output: { deleted: z.literal(true), id: z.number().int() },
    run: async (args, api) => {
      await api.delete(`/api/tasks/${args.id}`);
      return { deleted: true, id: args.id };
    },
  });

  const stateTools = [
    { name: 'close_task', title: 'Close task', path: 'close', description: `Use this when the user says a task is finished. Sets the status to "done". ${STATUS_NOTE}` },
    { name: 'cancel_task', title: 'Cancel task', path: 'cancel', description: `Use this when the user decides not to do a task. Sets the status to "canceled". ${STATUS_NOTE}` },
    { name: 'reopen_task', title: 'Reopen task', path: 'reopen', description: 'Use this when a done or canceled task should become active again. Sets the status to "open".' },
    { name: 'bookmark_task', title: 'Bookmark task', path: 'bookmark', description: 'Use this when the user asks to bookmark a task. Sets isBookmarked to true.' },
    { name: 'unbookmark_task', title: 'Unbookmark task', path: 'unbookmark', description: 'Use this when the user asks to remove the bookmark from a task. Sets isBookmarked to false.' },
  ];
  for (const tool of stateTools) {
    defineTool(context, {
      name: tool.name,
      title: tool.title,
      description: `${tool.description} Returns the updated task.`,
      kind: 'state',
      input: { id: id('task') },
      output: taskOutput,
      run: async (args, api) => ({ task: await api.post(`/api/tasks/${args.id}/${tool.path}`) }),
    });
  }
}
