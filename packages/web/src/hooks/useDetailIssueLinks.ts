import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IssueType } from 'meme-gtd-shared';
import { LinksService } from '../api/services/LinksService';
import type { LinkDisplayItem } from '../types/links';
import { getIssueReferenceTitles } from '../utils/issueReferenceTitles';

const emptyLinks: LinkDisplayItem[] = [];

export function useDetailIssueLinks(
  id: number | undefined,
  type: IssueType | undefined,
  revision = 0,
) {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(key => key + 1), []);
  const identity = id === undefined || type === undefined ? undefined : `${type}:${id}`;
  const requestKey = identity === undefined ? undefined : `${identity}:${revision}:${refreshKey}`;
  const [result, setResult] = useState<{
    identity: string;
    requestKey: string;
    links: LinkDisplayItem[];
    error: boolean;
  }>();

  useEffect(() => {
    if (identity === undefined || requestKey === undefined) return;
    let active = true;
    LinksService.listIssueLinks(String(id)).then(
      links => {
        if (active) setResult({ identity, requestKey, links, error: false });
      },
      error => {
        if (!active) return;
        console.error('Failed to load issue links:', error);
        setResult({ identity, requestKey, links: emptyLinks, error: true });
      },
    );
    return () => { active = false; };
  }, [id, identity, requestKey]);

  const current = result?.identity === identity ? result : undefined;
  const links = current?.links ?? emptyLinks;
  const titles = useMemo(() => getIssueReferenceTitles(links), [links]);
  return {
    links,
    titles,
    loading: requestKey !== undefined && current?.requestKey !== requestKey,
    error: current?.error ?? false,
    refresh,
  };
}
