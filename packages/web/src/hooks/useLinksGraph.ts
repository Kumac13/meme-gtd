import { useEffect, useState } from 'react';
import { ApiError, LinksService } from '../api';

export type LinksGraphData = Awaited<ReturnType<typeof LinksService.getLinksGraph>>;

export interface LinksGraphQuery {
  rootId?: number;
  depth?: number;
  q?: string;
  label?: string;
  projectId?: string;
  bookmarked?: 'true' | 'false';
  includeLabels?: 'true' | 'false';
}

export function useLinksGraph({
  rootId, depth, q, label, projectId, bookmarked, includeLabels,
}: LinksGraphQuery, enabled: boolean) {
  const [revision, setRevision] = useState(0);
  const scope = JSON.stringify([rootId, depth, q, label, projectId, bookmarked, includeLabels]);
  const [result, setResult] = useState<{
    scope: string;
    revision: number;
    graph?: LinksGraphData;
    error?: { message: string; missingRoot: boolean };
  }>();

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const request = LinksService.getLinksGraph(rootId, depth, q, label, projectId, bookmarked, includeLabels);
    void request.then(graph => {
      if (active) setResult({ scope, revision, graph });
    }).catch((error: unknown) => {
      if (!active) return;
      const missingRoot = error instanceof ApiError && error.status === 404;
      setResult({
        scope, revision,
        error: { message: missingRoot ? 'The starting issue is no longer available.' : 'Could not load the issue graph.', missingRoot },
      });
    });
    return () => {
      active = false;
      request.cancel();
    };
  }, [scope, revision, enabled, rootId, depth, q, label, projectId, bookmarked, includeLabels]);

  const current = enabled && result?.scope === scope ? result : undefined;
  return {
    graph: current?.graph,
    error: current?.revision === revision ? current.error : undefined,
    loading: enabled && current?.revision !== revision,
    reload: () => setRevision(value => value + 1),
  };
}
