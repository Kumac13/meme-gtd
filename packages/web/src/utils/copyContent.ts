import type { Comment } from '../components/CommentSection';
import { SearchService } from '../api/services/SearchService';

/**
 * Write already-in-hand text to the clipboard.
 *
 * Only for the synchronous case where the text is available at call time (the
 * write then happens within the click gesture while the document is focused).
 * For text that must be fetched first, see `exportAndCopySearchResults`, which
 * binds the write to the gesture via a promise-valued `ClipboardItem` — do NOT
 * `await` a fetch and then call this, or Chrome will silently hang the write
 * once the page is no longer focused.
 */
async function writeToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export interface CopyContentOptions {
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
  await writeToClipboard(content);
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
  /**
   * 'all' exports every item matching the filters (server-side, no pagination),
   * ignoring itemIds. 'loaded' (default) exports only the provided itemIds — the
   * current page / loaded range. Semantic search must stay 'loaded' since its
   * result set is a bounded top-K ranking.
   */
  scope?: 'loaded' | 'all';
}

interface ExportAndCopyResult {
  /** Number of items written to the clipboard. */
  total: number;
  /** True when scope='all' matched more items than the export cap. */
  truncated: boolean;
}

/**
 * Calls the server-side search export endpoint (which records a search.exported
 * activity log entry) and writes the JSON response to the clipboard.
 *
 * With scope='all' the server resolves every item matching `filters` (ignoring
 * `itemIds`), so the copy covers the full filtered set rather than just the
 * loaded page. With scope='loaded' the exported set is defined by `itemIds` —
 * the currently displayed/loaded range.
 *
 * The clipboard write is bound to the user's click gesture, NOT deferred until
 * after the fetch resolves. Awaiting a multi-second export fetch and only then
 * calling `navigator.clipboard.writeText` is unreliable on Chrome: if the
 * document is no longer focused when the write finally runs, the promise can
 * resolve (the button shows "Copied") while the system clipboard is never
 * updated — nothing is actually pasteable. `navigator.clipboard.write()` with a
 * promise-valued `ClipboardItem`, invoked synchronously in the same tick as the
 * click, keeps the write tied to the gesture; the browser fulfils it once the
 * fetch resolves. This MUST be called synchronously from the click handler
 * (before any `await`) or the gesture binding is lost.
 */
export function exportAndCopySearchResults(
  options: ExportAndCopyOptions
): Promise<ExportAndCopyResult> {
  const responsePromise = SearchService.exportSearchResults({
    type: options.type,
    filters: options.filters,
    itemIds: options.itemIds,
    scope: options.scope,
    matchedComments: options.matchedComments,
    matchedScores: options.matchedScores,
    includeComments: options.includeComments,
  });

  let writePromise: Promise<void>;
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blobPromise = responsePromise.then(
      (response) =>
        new Blob([JSON.stringify(response, null, 2)], { type: 'text/plain' })
    );
    writePromise = navigator.clipboard.write([
      new ClipboardItem({ 'text/plain': blobPromise }),
    ]);
  } else {
    // Older browsers without ClipboardItem: fall back to the deferred writeText
    // (which carries the focus caveat above, but is the best available there).
    writePromise = responsePromise.then((response) =>
      writeToClipboard(JSON.stringify(response, null, 2))
    );
  }

  return Promise.all([responsePromise, writePromise]).then(([response]) => ({
    total: response.total,
    truncated: response.truncated ?? false,
  }));
}
