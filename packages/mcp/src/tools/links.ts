import { z } from 'zod';
import type { Api } from '../api.js';
import { defineTool, csv, projectFilter, requireTask, ToolInputError, type ToolContext } from '../toolkit.js';
import {
  LinkWithDirection, Link, UrlLink, linksGraphShape, LINK_TYPES, id,
  labelsFilter, projectIdsFilter, noProjectFilter,
} from '../schemas.js';

const LINK_TYPE_NOTE = 'linkType describes the source issue relative to the target: source=12, target=5, linkType="child" means issue 12 is a child of issue 5. "relates" is a plain association; "derived_from" means the source was created from the target.';

async function findIssueLink(api: Api, issueId: number, linkId: number): Promise<unknown> {
  const links = (await api.get(`/api/issues/${issueId}/links`)) as Array<{ id: number }>;
  const link = links.find(candidate => candidate.id === linkId);
  if (!link) {
    throw new ToolInputError(`Link #${linkId} does not belong to issue #${issueId}. Nothing was changed. Use list_issue_links to find the right link ID.`);
  }
  return link;
}

async function findUrlLink(api: Api, issueId: number, urlLinkId: number): Promise<unknown> {
  const urlLinks = (await api.get(`/api/issues/${issueId}/url-links`)) as Array<{ id: number }>;
  const urlLink = urlLinks.find(candidate => candidate.id === urlLinkId);
  if (!urlLink) {
    throw new ToolInputError(`URL link #${urlLinkId} does not belong to issue #${issueId}. Nothing was changed. Use list_url_links to find the right URL link ID.`);
  }
  return urlLink;
}

export function registerLinkTools(context: ToolContext): void {
  defineTool(context, {
    name: 'list_issue_links',
    title: 'List issue links',
    description: `Use this when you need the tasks, memos and articles linked to one issue, for example a task's parent, children or related items. Each link carries its direction relative to the queried issue and a summary of the issue on the other end (targetIssue). ${LINK_TYPE_NOTE}`,
    kind: 'read',
    input: {
      issueId: id('issue (task, memo or article)'),
      type: z.enum(LINK_TYPES).optional().describe('Only links of this type.'),
    },
    output: { links: z.array(LinkWithDirection) },
    run: async (args, api) => ({ links: await api.get(`/api/issues/${args.issueId}/links`, { type: args.type }) }),
  });

  defineTool(context, {
    name: 'get_link',
    title: 'Get issue link',
    description: 'Use this when you need one specific link of an issue by its link ID, for example to confirm what a link connects before removing it.',
    kind: 'read',
    input: { issueId: id('issue (task, memo or article)'), linkId: id('link') },
    output: { link: LinkWithDirection },
    run: async (args, api) => ({ link: await findIssueLink(api, args.issueId, args.linkId) }),
  });

  defineTool(context, {
    name: 'get_links_graph',
    title: 'Get links graph',
    description: 'Use this when you need the network of linked issues rather than one issue\'s direct links: pass rootId (and optionally depth) to walk outward from one issue, or omit rootId to get the whole graph narrowed by the filters. Returns nodes (issues) and edges (links). When truncated is true the result hit the size limits shown in limits; narrow the query.',
    kind: 'read',
    input: {
      rootId: z.number().int().positive().optional().describe('Start from this task, memo or article ID.'),
      depth: z.number().int().positive().optional().describe('Maximum distance from rootId. Omit for everything reachable.'),
      q: z.string().min(1).optional().describe('Partial match in title, body or comments.'),
      labels: labelsFilter,
      projectIds: projectIdsFilter,
      noProject: noProjectFilter,
      bookmarked: z.boolean().optional().describe('true: only bookmarked issues.'),
      includeLabels: z.boolean().optional().describe('true: also return the labels of the returned issues (labels and memberships).'),
    },
    output: linksGraphShape,
    run: (args, api) => api.get('/api/links/graph', {
      rootId: args.rootId,
      depth: args.depth,
      q: args.q,
      label: csv(args.labels),
      projectId: projectFilter(args.projectIds, args.noProject),
      bookmarked: args.bookmarked,
      includeLabels: args.includeLabels,
    }),
  });

  defineTool(context, {
    name: 'create_link',
    title: 'Link two issues',
    description: `Use this when the user asks to relate two issues (tasks, memos or articles), for example to make one task a child of another. ${LINK_TYPE_NOTE} Returns the new link.`,
    kind: 'create',
    input: {
      sourceIssueId: id('source issue'),
      targetIssueId: id('target issue'),
      linkType: z.enum(LINK_TYPES).describe('Relationship of the source to the target.'),
    },
    output: { link: Link },
    // isPromotion はメモ→タスク昇格フロー専用のため、この経路からは渡さない。
    run: async (args, api) => ({ link: await api.post('/api/links', args) }),
  });

  defineTool(context, {
    name: 'delete_link',
    title: 'Unlink from task',
    description: 'Use this when the user asks to remove a link between a task and another issue. Only links that belong to the given task can be removed; pass that task\'s ID and the link ID from list_issue_links. The linked issues themselves are not deleted.',
    kind: 'delete',
    input: { taskId: id('task'), linkId: id('link') },
    output: { deleted: z.literal(true), taskId: z.number().int(), linkId: z.number().int() },
    run: async (args, api) => {
      await requireTask(api, args.taskId);
      await findIssueLink(api, args.taskId, args.linkId);
      await api.delete(`/api/links/${args.linkId}`);
      return { deleted: true, taskId: args.taskId, linkId: args.linkId };
    },
  });

  defineTool(context, {
    name: 'list_url_links',
    title: 'List external links',
    description: 'Use this when you need the external URLs attached to a task, memo or article (reference pages, pull requests, documents).',
    kind: 'read',
    input: { issueId: id('issue (task, memo or article)') },
    output: { urlLinks: z.array(UrlLink) },
    run: async (args, api) => ({ urlLinks: await api.get(`/api/issues/${args.issueId}/url-links`) }),
  });

  defineTool(context, {
    name: 'get_url_link',
    title: 'Get external link',
    description: 'Use this when you need one specific external URL of an issue by its URL link ID.',
    kind: 'read',
    input: { issueId: id('issue (task, memo or article)'), urlLinkId: id('URL link') },
    output: { urlLink: UrlLink },
    run: async (args, api) => ({ urlLink: await findUrlLink(api, args.issueId, args.urlLinkId) }),
  });

  defineTool(context, {
    name: 'create_url_link',
    title: 'Add external link',
    description: 'Use this when the user asks to attach an external URL to a task, memo or article. Only stores the URL and an optional display title; the page is not fetched. Returns the new URL link.',
    kind: 'create',
    input: {
      issueId: id('issue (task, memo or article)'),
      url: z.string().url().describe('External URL to attach.'),
      title: z.string().max(200).optional().describe('Display title shown instead of the raw URL.'),
    },
    output: { urlLink: UrlLink },
    run: async ({ issueId, ...body }, api) => ({ urlLink: await api.post(`/api/issues/${issueId}/url-links`, body) }),
  });

  defineTool(context, {
    name: 'update_url_link',
    title: 'Rename task external link',
    description: 'Use this when the user asks to change the display title of an external URL attached to a task. Only the title can change (pass null to clear it); to change the URL itself, delete the link and add a new one. The URL link must belong to the given task.',
    kind: 'update',
    input: {
      taskId: id('task'),
      urlLinkId: id('URL link'),
      title: z.string().max(200).nullable().describe('New display title, or null to clear it.'),
    },
    output: { urlLink: UrlLink },
    run: async (args, api) => {
      await requireTask(api, args.taskId);
      await findUrlLink(api, args.taskId, args.urlLinkId);
      return { urlLink: await api.patch(`/api/url-links/${args.urlLinkId}`, { title: args.title }) };
    },
  });

  defineTool(context, {
    name: 'delete_url_link',
    title: 'Remove task external link',
    description: 'Use this when the user asks to remove an external URL from a task. The URL link must belong to the given task.',
    kind: 'delete',
    input: { taskId: id('task'), urlLinkId: id('URL link') },
    output: { deleted: z.literal(true), taskId: z.number().int(), urlLinkId: z.number().int() },
    run: async (args, api) => {
      await requireTask(api, args.taskId);
      await findUrlLink(api, args.taskId, args.urlLinkId);
      await api.delete(`/api/url-links/${args.urlLinkId}`);
      return { deleted: true, taskId: args.taskId, urlLinkId: args.urlLinkId };
    },
  });
}
