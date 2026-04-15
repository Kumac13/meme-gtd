import type { Comment } from '../components/CommentSection';
import { SearchService } from '../api/services/SearchService';

interface CopyContentOptions {
  title: string | null;
  body: string;
  comments?: Comment[];
  includeTitle?: boolean;
}

/**
 * Builds formatted content for copying to clipboard
 * Format with title: # Title\n\n---\n\nBody\n\n## Comments\n\nComment1\n\n---\n\nComment2
 * Format without title: Body\n\n## Comments\n\nComment1\n\n---\n\nComment2
 */
function buildCopyContent({
  title,
  body,
  comments = [],
  includeTitle = true,
}: CopyContentOptions): string {
  let content: string;

  if (includeTitle) {
    const displayTitle = title || 'Untitled';
    content = `# ${displayTitle}\n\n---\n\n${body}`;
  } else {
    content = body;
  }

  if (comments.length > 0) {
    const commentsText = comments.map((c) => c.bodyMd).join('\n\n---\n\n');
    content += `\n\n## Comments\n\n${commentsText}`;
  }

  return content;
}

/**
 * Copies item content (title, body, comments) to clipboard
 */
export async function copyItemContent(options: CopyContentOptions): Promise<void> {
  const content = buildCopyContent(options);
  await navigator.clipboard.writeText(content);
}

export type ExportItemType = 'memos' | 'tasks' | 'articles';

export interface ExportAndCopyOptions {
  type: ExportItemType;
  filters: {
    query?: string;
    searchMode?: 'keyword' | 'semantic';
    labels?: string[];
    dateFrom?: string;
    dateTo?: string;
    bookmarked?: boolean;
    projectIds?: number[];
    includeNoProject?: boolean;
    status?: string;
  };
  itemIds: number[];
  matchedComments?: Record<string, string>;
  matchedScores?: Record<string, number>;
  includeComments: boolean;
}

/**
 * Calls the server-side search export endpoint (which records a search.exported
 * activity log entry) and writes the JSON response to the clipboard.
 *
 * The scope of the exported results is defined by `itemIds` — that is, the
 * currently displayed/loaded range, not the full set of matches.
 */
export async function exportAndCopySearchResults(
  options: ExportAndCopyOptions
): Promise<void> {
  const response = await SearchService.exportSearchResults({
    type: options.type,
    filters: options.filters,
    itemIds: options.itemIds,
    matchedComments: options.matchedComments,
    matchedScores: options.matchedScores,
    includeComments: options.includeComments,
  });
  const json = JSON.stringify(response, null, 2);
  await navigator.clipboard.writeText(json);
}
