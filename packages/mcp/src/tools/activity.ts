import { z } from 'zod';
import { defineTool, csv, type ToolContext } from '../toolkit.js';
import { ActivityLogEntry, CompletedTaskEntry, KeywordSearchResult, EVENT_TYPES, id, dateOnly, labelsFilter, pageOutput } from '../schemas.js';

const entriesOutput = { entries: z.array(ActivityLogEntry) };
const limit = () => z.number().int().min(1).max(200).default(50).describe('Maximum number of entries to return (default 50, max 200).');
const order = (defaultOrder: 'asc' | 'desc') =>
  z.enum(['asc', 'desc']).optional().describe(`Sort by time of the event. Default "${defaultOrder}".`);

export function registerActivityTools(context: ToolContext): void {
  defineTool(context, {
    name: 'list_activity_log',
    title: 'List activity',
    description: 'Use this when the user asks what happened across meme-gtd: which tasks, memos, articles, labels, projects, links or comments were created or changed, optionally narrowed by issue, project, label, event type or time range. Each entry has an event type, a timestamp and a payload with the details. Newest first by default.',
    kind: 'read',
    input: {
      issueId: z.number().int().positive().optional().describe('Only events about this issue.'),
      projectId: z.number().int().positive().optional().describe('Only events about this project.'),
      labelId: z.number().int().positive().optional().describe('Only events about this label.'),
      eventType: z.enum(EVENT_TYPES).optional().describe('Only events of this type.'),
      sourceType: z.enum(['cli', 'api', 'system']).optional().describe('Only events recorded by this source. Web, iOS and these tools all record as "api".'),
      from: z.string().datetime().optional().describe('Only events at or after this instant (ISO 8601 with Z or an offset, e.g. 2026-01-31T15:00:00Z).'),
      to: z.string().datetime().optional().describe('Only events at or before this instant (ISO 8601 with Z or an offset).'),
      limit: limit(),
      offset: z.number().int().min(0).default(0).describe('Number of entries to skip.'),
      order: order('desc'),
    },
    output: entriesOutput,
    run: async (args, api) => ({ entries: await api.get('/api/activity-log', args) }),
  });

  defineTool(context, {
    name: 'get_issue_activity_log',
    title: 'Get issue activity',
    description: 'Use this when you need the history of one task, memo or article: creation, edits, status changes, labels, links and comments. Oldest first by default. A link that was added and later removed is left out.',
    kind: 'read',
    input: { issueId: id('issue (task, memo or article)'), limit: limit(), order: order('asc') },
    output: entriesOutput,
    run: async ({ issueId, ...query }, api) => ({ entries: await api.get(`/api/activity-log/issues/${issueId}`, query) }),
  });

  defineTool(context, {
    name: 'get_project_activity_log',
    title: 'Get project activity',
    description: 'Use this when you need the history of one project: its creation, edits, and items added or removed. Newest first by default.',
    kind: 'read',
    input: { projectId: id('project'), limit: limit(), order: order('desc') },
    output: entriesOutput,
    run: async ({ projectId, ...query }, api) => ({ entries: await api.get(`/api/activity-log/projects/${projectId}`, query) }),
  });

  defineTool(context, {
    name: 'get_completed_tasks',
    title: 'Get completed tasks',
    description: 'Use this when the user asks what was finished in a period, for example for a daily or weekly review. Returns tasks closed between the two dates with the projects and labels they had at that time. Both dates default to today.',
    kind: 'read',
    input: {
      from: dateOnly().optional().describe('First day of the period (YYYY-MM-DD). Defaults to today.'),
      to: dateOnly().optional().describe('Last day of the period (YYYY-MM-DD). Defaults to today.'),
      limit: limit(),
    },
    output: { tasks: z.array(CompletedTaskEntry) },
    run: async (args, api) => ({ tasks: await api.get('/api/activity-log/completed-tasks', args) }),
  });

  defineTool(context, {
    name: 'get_activity_log_entry',
    title: 'Get activity entry',
    description: 'Use this when you need one activity entry by its ID, for example to re-read the details of an event found with another activity tool.',
    kind: 'read',
    input: { id: id('activity log entry') },
    output: { entry: ActivityLogEntry },
    run: async (args, api) => ({ entry: await api.get(`/api/activity-log/${args.id}`) }),
  });

  defineTool(context, {
    name: 'keyword_search',
    title: 'Search by keyword',
    description: 'Use this when the user wants to find tasks, memos or articles by a word or phrase and you do not know which type holds it. Matches title, body and comments by partial match, and returns each matching issue with where it matched. Returns one page with total/limit/offset.',
    kind: 'read',
    input: {
      q: z.string().min(1).describe('Word or phrase to look for. Matched as-is, not split into terms.'),
      types: z.array(z.enum(['memo', 'task', 'article'])).min(1).optional().describe('Only these issue types. Omit for all.'),
      status: z.string().min(1).optional().describe('Only issues in this task status (e.g. "next", "done").'),
      labels: labelsFilter,
      bookmarked: z.literal(true).optional().describe('Set true to return only bookmarked issues.'),
      order: z.enum(['asc', 'desc']).optional().describe('Sort by last update. Default "desc".'),
      limit: z.number().int().min(1).max(100).default(20).describe('Maximum number of results (default 20, max 100).'),
      offset: z.number().int().min(0).default(0).describe('Number of results to skip.'),
    },
    output: (({ data, ...rest }) => ({ results: data, ...rest }))(pageOutput(KeywordSearchResult)),
    run: (args, api) => api.get('/api/search/keyword', {
      q: args.q,
      types: csv(args.types),
      status: args.status,
      label: csv(args.labels),
      bookmarked: args.bookmarked,
      order: args.order,
      limit: args.limit,
      offset: args.offset,
    }),
  });
}
