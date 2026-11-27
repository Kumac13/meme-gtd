import type { IssueType } from 'meme-gtd-shared';
import type { LinkDisplayItem } from '../types/links';

export type IssueReferenceTitles = ReadonlyMap<string, string>;

export function issueReferenceKey(type: IssueType, id: number): string {
  return `${type}:${id}`;
}

export function issueLinkDisplayTitle(title: string): string {
  return title.length > 100 ? `${title.substring(0, 100)}...` : title;
}

export function isDeletedIssueLink(title: string): boolean {
  return title.includes('(deleted)');
}

export function getIssueReferenceTitles(links: LinkDisplayItem[]): IssueReferenceTitles {
  const titles = new Map<string, string>();
  for (const link of links) {
    const target = link.targetIssue;
    const otherId = link.direction === 'incoming' ? link.sourceIssueId : link.targetIssueId;
    if (!target || target.id !== otherId || !target.title?.trim()
      || (target.status === null && target.title === `Issue #${otherId}`)
      || isDeletedIssueLink(target.title)) {
      continue;
    }
    titles.set(issueReferenceKey(target.type, otherId), issueLinkDisplayTitle(target.title));
  }
  return titles;
}
