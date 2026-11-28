import { z } from 'zod';
import { defineTool, csv, projectFilter, type ToolContext } from '../toolkit.js';
import {
  Memo, MemoListItem, Article, Template, id, dateOnly, pageInput, pageOutput,
  labelsFilter, projectIdsFilter, noProjectFilter,
} from '../schemas.js';

export function registerMemoArticleTools(context: ToolContext): void {
  defineTool(context, {
    name: 'list_memos',
    title: 'List memos',
    description: 'Use this when the user wants to browse or filter memos (quick notes the user captured) by label, project, bookmark, creation date or body text. Returns one page with total/limit/offset. Memos cannot be created, edited or deleted through these tools.',
    kind: 'read',
    input: {
      bookmarked: z.boolean().optional().describe('true: only bookmarked memos. false: only memos that are not bookmarked.'),
      labels: labelsFilter,
      projectIds: projectIdsFilter,
      noProject: noProjectFilter,
      search: z.string().min(1).optional().describe('Free-text search over the memo body.'),
      createdFrom: dateOnly().optional().describe('Only memos created on or after this date (YYYY-MM-DD).'),
      createdTo: dateOnly().optional().describe('Only memos created on or before this date (YYYY-MM-DD).'),
      order: z.enum(['asc', 'desc']).optional().describe('Sort by creation time. Default "desc" (newest first).'),
      ...pageInput(100, 20),
    },
    output: pageOutput(MemoListItem),
    run: (args, api) => api.get('/api/memos', {
      bookmarked: args.bookmarked,
      label: csv(args.labels),
      projectId: projectFilter(args.projectIds, args.noProject),
      search: args.search,
      createdFrom: args.createdFrom,
      createdTo: args.createdTo,
      order: args.order,
      limit: args.limit,
      offset: args.offset,
    }),
  });

  defineTool(context, {
    name: 'get_memo',
    title: 'Get memo',
    description: 'Use this when you need the full text of one memo by its ID. Fails if the ID is not a memo.',
    kind: 'read',
    input: { id: id('memo') },
    output: { memo: Memo },
    run: async (args, api) => ({ memo: await api.get(`/api/memos/${args.id}`) }),
  });

  defineTool(context, {
    name: 'list_articles',
    title: 'List articles',
    description: 'Use this when the user wants to browse or filter articles (web pages the user saved, or documents written by hand) by label, project, bookmark, origin or text. Returns one page with total/limit/offset; each item includes the full Markdown body. Articles cannot be created, edited or deleted through these tools.',
    kind: 'read',
    input: {
      search: z.string().min(1).optional().describe('Search over article title and content.'),
      labels: labelsFilter,
      projectIds: projectIdsFilter,
      bookmarked: z.boolean().optional().describe('true: only bookmarked articles. false: only articles that are not bookmarked.'),
      origin: z.enum(['web', 'manual']).optional().describe('"web": saved from a web page. "manual": written by hand.'),
      ...pageInput(100, 10),
    },
    output: pageOutput(Article),
    run: (args, api) => api.get('/api/articles', {
      search: args.search,
      label: csv(args.labels),
      projectId: csv(args.projectIds),
      bookmarked: args.bookmarked,
      origin: args.origin,
      limit: args.limit,
      offset: args.offset,
    }),
  });

  defineTool(context, {
    name: 'get_article',
    title: 'Get article',
    description: 'Use this when you need the full text of one article by its ID. meta.originalUrl holds the source page for web articles. Fails if the ID is not an article.',
    kind: 'read',
    input: { id: id('article') },
    output: { article: Article },
    run: async (args, api) => ({ article: await api.get(`/api/articles/${args.id}`) }),
  });

  defineTool(context, {
    name: 'list_templates',
    title: 'List templates',
    description: 'Use this when the user wants to see the templates available for new tasks or articles. A template holds a title, a Markdown body skeleton and preset labels and projects. Returns one page with total/limit/offset. Templates are read-only through these tools.',
    kind: 'read',
    input: {
      search: z.string().min(1).optional().describe('Search over template title and body.'),
      target: z.enum(['task', 'article']).optional().describe('Only templates that produce this issue type.'),
      ...pageInput(100, 20),
    },
    output: pageOutput(Template),
    run: (args, api) => api.get('/api/templates', {
      search: args.search,
      target: args.target,
      limit: args.limit,
      offset: args.offset,
    }),
  });

  defineTool(context, {
    name: 'get_template',
    title: 'Get template',
    description: 'Use this when you need one template by its ID, for example to copy its body into create_task. Fails if the ID is not a template.',
    kind: 'read',
    input: { id: id('template') },
    output: { template: Template },
    run: async (args, api) => ({ template: await api.get(`/api/templates/${args.id}`) }),
  });
}
