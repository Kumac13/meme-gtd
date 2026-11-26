import type { LinksGraphQuery } from '../hooks/useLinksGraph';
import { getSearchParam, parseLabelParam } from './urlFilterHelpers';

function positiveInteger(raw: string | null): number | undefined {
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const number = Number(raw);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

export function parseLinksUrl(params: URLSearchParams) {
  const rootId = positiveInteger(params.get('rootId'));
  const depth = positiveInteger(params.get('depth'));
  const labels = parseLabelParam(params.get('label'));
  const projects = (params.get('projectId') ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const invalidKeys = new Set<string>();
  if (params.has('rootId') && (rootId === undefined || params.getAll('rootId').length !== 1)) invalidKeys.add('rootId');
  if (params.has('depth') && (!rootId || !depth || params.getAll('depth').length !== 1)) invalidKeys.add('depth');
  if (projects.some(value => value !== 'none' && !positiveInteger(value))) invalidKeys.add('projectId');
  for (const key of ['bookmarked', 'includeLabels']) {
    if (params.has(key) && (params.getAll(key).length !== 1 || !['true', 'false'].includes(params.get(key)!))) invalidKeys.add(key);
  }

  const query: LinksGraphQuery = {
    rootId,
    depth,
    q: getSearchParam(params).trim() || undefined,
    label: [...labels].join(',') || undefined,
    projectId: projects.join(',') || undefined,
    bookmarked: params.get('bookmarked') === 'true' ? 'true' : undefined,
    includeLabels: params.get('includeLabels') === 'true' ? 'true' : undefined,
  };
  return { query, labels, projects: new Set(projects), invalidKeys };
}

export function setLinksRoot(params: URLSearchParams, rootId?: number): URLSearchParams {
  const next = new URLSearchParams(params);
  if (rootId === undefined) next.delete('rootId');
  else next.set('rootId', String(rootId));
  next.delete('depth');
  return next;
}

export function linksPath(rootId: number, search = ''): string {
  const params = setLinksRoot(new URLSearchParams(search), rootId);
  return `/links?${params}`;
}
