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
  /**
   * Semantic search relevance scores keyed by item id (0-1).
   */
  matchedScores?: Record<number, number> | Record<string, number>;
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
  matchedScores,
}: CopyResultsButtonsProps) {
  const [justCopied, setJustCopied] = useState<'results' | 'comments' | null>(null);
  const [copying, setCopying] = useState<'results' | 'comments' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Copy the full filtered set (server resolves every match, no pagination).
  // Semantic search is the exception: its result set is a bounded top-K ranking
  // with no meaningful "all", so it stays scoped to the loaded items.
  const scope: 'loaded' | 'all' =
    filters.searchMode === 'semantic' ? 'loaded' : 'all';

  const handleCopy = async (includeComments: boolean) => {
    setError(null);
    setWarning(null);
    try {
      setCopying(includeComments ? 'comments' : 'results');
      // Normalize matchedComments/matchedScores keys to string form for the API
      const normalizedMatched: Record<string, string> | undefined = matchedComments
        ? Object.fromEntries(
            Object.entries(matchedComments as Record<string | number, string>)
          )
        : undefined;
      const normalizedScores: Record<string, number> | undefined = matchedScores
        ? Object.fromEntries(
            Object.entries(matchedScores as Record<string | number, number>)
          )
        : undefined;
      const result = await exportAndCopySearchResults({
        type,
        filters,
        itemIds,
        scope,
        matchedComments: normalizedMatched,
        matchedScores: normalizedScores,
        includeComments,
      });
      setJustCopied(includeComments ? 'comments' : 'results');
      setTimeout(() => setJustCopied(null), 1200);
      if (result.truncated) {
        setWarning(`Copied first ${result.total} (too many to copy all)`);
        setTimeout(() => setWarning(null), 3000);
      }
    } catch (err) {
      console.error('Failed to copy search results:', err);
      setError(err instanceof Error ? err.message : 'Failed to copy');
      setTimeout(() => setError(null), 2000);
    } finally {
      setCopying(null);
    }
  };

  return (
    <div className="inline-flex items-center gap-2 ml-3">
      <button
        type="button"
        onClick={() => handleCopy(false)}
        disabled={copying !== null}
        className="text-xs text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline disabled:opacity-50"
      >
        {copying === 'results'
          ? 'Copying...'
          : justCopied === 'results'
          ? 'Copied'
          : 'Copy Results'}
      </button>
      <span className="text-gray-300" aria-hidden>
        |
      </span>
      <button
        type="button"
        onClick={() => handleCopy(true)}
        disabled={copying !== null}
        className="text-xs text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline disabled:opacity-50"
      >
        {copying === 'comments'
          ? 'Copying...'
          : justCopied === 'comments'
          ? 'Copied'
          : 'Copy with Comments'}
      </button>
      {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
      {warning && <span className="text-xs text-amber-600 ml-2">{warning}</span>}
    </div>
  );
}
