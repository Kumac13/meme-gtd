import { z } from 'zod';

// ---- 入力の共通部品 ----

export const TASK_STATUSES = ['inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'] as const;
export const LINK_TYPES = ['parent', 'child', 'relates', 'derived_from'] as const;
export const EVENT_TYPES = [
  'task.created', 'issue.transferred', 'task.updated', 'task.status_changed', 'task.deleted', 'task.bookmarked',
  'memo.created', 'memo.updated', 'memo.promoted', 'memo.deleted', 'memo.bookmarked',
  'article.created', 'article.updated', 'article.deleted', 'article.bookmarked',
  'label.created', 'label.deleted', 'label.assigned', 'label.removed',
  'project.created', 'project.updated', 'project.deleted', 'project.item_added', 'project.item_removed',
  'link.created', 'link.deleted',
  'comment.created', 'comment.updated', 'comment.deleted',
  'search.exported',
] as const;

export const id = (what: string) =>
  z.number().int().positive().describe(`Existing numeric ${what} ID. Look it up with a list or search tool; never guess.`);

// 同じインスタンスを複数の引数で使うと JSON Schema が $ref になるため、呼び出しごとに作る。
export const localDateTime = () => z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, 'Use YYYY-MM-DDTHH:MM:SS without a UTC offset.')
  .describe('Wall-clock time in the meme-gtd server\'s local timezone, YYYY-MM-DDTHH:MM:SS, without a UTC offset.');

export const dateOnly = () => z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
  .describe('Date in YYYY-MM-DD.');

export const pageInput = (max: number, defaultLimit: number) => ({
  limit: z.number().int().min(1).max(max).default(defaultLimit).describe(`Maximum number of items to return (default ${defaultLimit}, max ${max}).`),
  offset: z.number().int().min(0).default(0).describe('Number of items to skip. Use total/limit/offset to page.'),
});

export const labelsFilter = z.array(z.string().min(1)).min(1).optional().describe('Label names. Items with any of these labels match (OR).');
export const projectIdsFilter = z.array(z.number().int().positive()).min(1).optional().describe('Project IDs. Items in any of these projects match (OR).');
export const noProjectFilter = z.boolean().optional().describe('Set true to also match items that belong to no project.');

// ---- 出力（REST API の応答から、現行で使う項目だけを宣言する）----

const taskShape = {
  id: z.number().int(),
  type: z.literal('task'),
  title: z.string(),
  bodyMd: z.string(),
  status: z.enum(TASK_STATUSES),
  taskKind: z.enum(['event', 'action']),
  scheduledStart: z.string().nullable(),
  scheduledEnd: z.string().nullable(),
  isAllDay: z.boolean(),
  actualStart: z.string().nullable(),
  actualEnd: z.string().nullable(),
  isBookmarked: z.boolean(),
  isDeleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  labels: z.array(z.string()),
};
export const Task = z.object({ ...taskShape, commentsCount: z.number().int().optional() });
export const TaskListItem = z.object({
  ...taskShape,
  commentCount: z.number().int(),
  preview: z.string().optional(),
  projectIds: z.array(z.number().int()),
  linkIds: z.array(z.number().int()),
});

const memoShape = {
  id: z.number().int(),
  type: z.literal('memo'),
  bodyMd: z.string(),
  isBookmarked: z.boolean(),
  isDeleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  labels: z.array(z.string()),
};
export const Memo = z.object({ ...memoShape, commentsCount: z.number().int().optional() });
export const MemoListItem = z.object({ ...memoShape, commentCount: z.number().int(), preview: z.string().optional() });

export const Article = z.object({
  id: z.number().int(),
  type: z.literal('article'),
  title: z.string(),
  bodyMd: z.string(),
  origin: z.enum(['web', 'manual']),
  meta: z.object({
    originalUrl: z.string().optional(),
    siteName: z.string().nullable().optional(),
    archivedAt: z.string().optional(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  isBookmarked: z.boolean(),
  isDeleted: z.boolean(),
  labels: z.array(z.string()).optional(),
  commentCount: z.number().int().optional(),
});

export const Comment = z.object({
  id: z.number().int(),
  issueId: z.number().int(),
  bodyMd: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const projectShape = {
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['planned', 'active', 'paused', 'done', 'canceled']),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  viewMeta: z.object({ viewType: z.enum(['board', 'table']), columns: z.array(z.string()).optional() }),
  createdAt: z.string(),
};
export const Project = z.object(projectShape);
const projectItemShape = {
  id: z.number().int(),
  projectId: z.number().int(),
  issueId: z.number().int(),
  position: z.number(),
  viewMeta: z.object({ column: z.string().optional() }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
};
export const ProjectItem = z.object(projectItemShape);
export const ProjectDetail = z.object({
  ...projectShape,
  items: z.array(z.object({
    ...projectItemShape,
    issue: z.object({
      id: z.number().int(),
      type: z.string(),
      title: z.string(),
      status: z.string().nullable(),
    }),
  })),
});

const linkShape = {
  id: z.number().int(),
  sourceIssueId: z.number().int(),
  targetIssueId: z.number().int(),
  linkType: z.enum(LINK_TYPES),
  createdAt: z.string(),
};
export const Link = z.object(linkShape);
export const LinkWithDirection = z.object({
  ...linkShape,
  direction: z.enum(['outgoing', 'incoming']),
  targetIssue: z.object({
    id: z.number().int(),
    type: z.string(),
    title: z.string(),
    status: z.string().nullable(),
  }),
});
export const linksGraphShape = {
  rootId: z.number().int().nullable(),
  depth: z.number().int().nullable(),
  nodes: z.array(z.object({
    id: z.number().int(),
    type: z.enum(['task', 'memo', 'article']),
    title: z.string(),
    status: z.string().nullable(),
  })),
  edges: z.array(z.object({
    id: z.number().int(),
    sourceIssueId: z.number().int(),
    targetIssueId: z.number().int(),
    linkType: z.enum(LINK_TYPES),
  })),
  labels: z.array(z.object({ id: z.number().int(), name: z.string() })),
  memberships: z.array(z.object({ issueId: z.number().int(), labelId: z.number().int() })),
  truncated: z.boolean(),
  limits: z.object({
    issueNodes: z.number().int(),
    issueEdges: z.number().int(),
    labelNodes: z.number().int(),
    memberships: z.number().int(),
  }),
};

export const UrlLink = z.object({
  id: z.number().int(),
  issueId: z.number().int(),
  url: z.string(),
  title: z.string().nullable(),
  createdAt: z.string(),
});

export const Label = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  memoCount: z.number().int(),
  taskCount: z.number().int(),
  articleCount: z.number().int(),
});

export const ActivityLogEntry = z.object({
  id: z.number().int(),
  eventType: z.string(),
  occurredAt: z.string(),
  sourceType: z.string(),
  payload: z.record(z.unknown()),
  issueId: z.number().int().nullable(),
  projectId: z.number().int().nullable(),
  labelId: z.number().int().nullable(),
});

export const CompletedTaskEntry = z.object({
  taskId: z.number().int(),
  title: z.string(),
  completedAt: z.string(),
  projectSnapshot: z.array(z.object({ id: z.number().int(), name: z.string() })).optional(),
  labelSnapshot: z.array(z.object({ id: z.number().int(), name: z.string() })).optional(),
});

export const KeywordSearchResult = z.object({
  id: z.number().int(),
  type: z.string(),
  title: z.string().nullable(),
  bodyMd: z.string(),
  status: z.string().nullable(),
  isBookmarked: z.boolean(),
  labels: z.array(z.string()),
  commentCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  matches: z.array(z.object({
    field: z.enum(['issue', 'comment']),
    commentId: z.number().int().nullable(),
    text: z.string(),
  })),
});

export const Template = z.object({
  id: z.number().int(),
  type: z.literal('template'),
  templateTarget: z.enum(['task', 'article']),
  title: z.string().nullable(),
  bodyMd: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isBookmarked: z.boolean(),
  isDeleted: z.boolean(),
  labels: z.array(z.string()).optional(),
  projectIds: z.array(z.number().int()).optional(),
});

export const pageOutput = <T extends z.ZodTypeAny>(item: T) => ({
  data: z.array(item),
  total: z.number().int().describe('Total number of matches ignoring limit/offset.'),
  limit: z.number().int(),
  offset: z.number().int(),
});
