import type { IssueType } from 'meme-gtd-shared';
import type { LinkDisplayItem } from '../types/links';

export type IssueReferenceTitles = ReadonlyMap<string, string>;

export function issueReferenceKey(type: IssueType, id: number): string {
  return `${type}:${id}`;
}

export function issueLinkDisplayTitle(title: string): string {
  return title.length > 100 ? `${title.substring(0, 100)}...` : title;
}

export function isMissingIssueLinkTarget(target: LinkDisplayItem['targetIssue']): boolean {
  // Links API は参照先が欠損した場合にこの組み合わせを返す。
  return target.type === 'task' && target.status === null && target.title === `Issue #${target.id}`;
}

export function getIssueReferenceTitles(links: LinkDisplayItem[]): IssueReferenceTitles {
  const titles = new Map<string, string>();
  for (const link of links) {
    const target = link.targetIssue;
    const otherId = link.direction === 'incoming' ? link.sourceIssueId : link.targetIssueId;
    if (!target || target.id !== otherId || !target.title?.trim()
      || isMissingIssueLinkTarget(target)) {
      continue;
    }
    titles.set(issueReferenceKey(target.type, otherId), issueLinkDisplayTitle(target.title));
  }
  return titles;
}
