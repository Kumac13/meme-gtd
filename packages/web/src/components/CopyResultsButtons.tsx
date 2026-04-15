import { useState } from 'react';
import {
  exportAndCopySearchResults,
  type ExportAndCopyOptions,
  type ExportItemType,
} from '../utils/copyContent';

interface CopyResultsButtonsProps {
  type: ExportItemType;
  filters: ExportAndCopyOptions['filters'];
  itemIds: number[];
  /**
   * Matched comment snippets keyed by item id. Accepts either number or string
   * keys for convenience — both serialize to string keys in JSON.
   */
  matchedComments?: Record<number, string> | Record<string, string>;
}

/**
 * Two buttons — "Copy Results" and "Copy with Comments" — placed next to the
 * count text on a list view. Only rendered when there is at least one item to
 * copy; the enclosing count-text block is already hidden in that case, so we
 * rely on the parent to do that.
 */
export default function CopyResultsButtons({
  type,
  filters,
  itemIds,
  matchedComments,
}: CopyResultsButtonsProps) {
  const [justCopied, setJustCopied] = useState<'results' | 'comments' | null>(null);
  const [copyingWithComments, setCopyingWithComments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async (includeComments: boolean) => {
    setError(null);
    try {
      if (includeComments) setCopyingWithComments(true);
      // Normalize matchedComments keys to string form for the API
      const normalizedMatched: Record<string, string> | undefined = matchedComments
        ? Object.fromEntries(
            Object.entries(matchedComments as Record<string | number, string>)
          )
        : undefined;
      await exportAndCopySearchResults({
        type,
        filters,
        itemIds,
        matchedComments: normalizedMatched,
        includeComments,
      });
      setJustCopied(includeComments ? 'comments' : 'results');
      setTimeout(() => setJustCopied(null), 1200);
    } catch (err) {
      console.error('Failed to copy search results:', err);
      setError(err instanceof Error ? err.message : 'Failed to copy');
      setTimeout(() => setError(null), 2000);
    } finally {
      if (includeComments) setCopyingWithComments(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2 ml-3">
      <button
        type="button"
        onClick={() => handleCopy(false)}
        className="text-xs text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
      >
        {justCopied === 'results' ? 'Copied' : 'Copy Results'}
      </button>
      <span className="text-gray-300" aria-hidden>
        |
      </span>
      <button
        type="button"
        onClick={() => handleCopy(true)}
        disabled={copyingWithComments}
        className="text-xs text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline disabled:opacity-50"
      >
        {copyingWithComments
          ? 'Copying...'
          : justCopied === 'comments'
          ? 'Copied'
          : 'Copy with Comments'}
      </button>
      {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
    </div>
  );
}
