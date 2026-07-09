import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { IssueType } from 'meme-gtd-shared';
import { HighlightsService } from '../api/services/HighlightsService';
import { MarkdownRenderer } from '../utils/markdown';
import { MarkdownTextarea } from './MarkdownTextarea';
import EditableContent from './EditableContent';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { computeQuote, locateQuote } from '../utils/highlightAnchor';

interface HighlightComment {
  id: number;
  issueId: number;
  highlightId?: number;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
}

interface HighlightItem {
  id: number;
  issueId: number;
  exact: string;
  prefix?: string;
  suffix?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
  comments: HighlightComment[];
}

interface ArticleHighlightsProps {
  articleId: number;
  /** Ref to the rendered article body container (the EditableContent view div). */
  contentRef: React.RefObject<HTMLDivElement | null>;
  onIssueLinkClick?: (id: number, type: IssueType) => void;
  /** Called after a comment mutation so the parent can refetch links (#id mentions). */
  onLinksRefresh?: () => void;
}

// CSS Custom Highlight API is behind these globals; feature-detect at runtime.
const HighlightCtor: (new (...ranges: Range[]) => unknown) | undefined =
  typeof window !== 'undefined' ? (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight : undefined;
const cssHighlights: Map<string, unknown> | undefined =
  typeof CSS !== 'undefined' ? (CSS as unknown as { highlights?: Map<string, unknown> }).highlights : undefined;
const HIGHLIGHTS_SUPPORTED = Boolean(HighlightCtor && cssHighlights);

export default function ArticleHighlights({
  articleId,
  contentRef,
  onIssueLinkClick,
  onLinksRefresh,
}: ArticleHighlightsProps) {
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [layoutTick, setLayoutTick] = useState(0);
  const [iconPositions, setIconPositions] = useState<Record<number, { x: number; y: number }>>({});
  const [toolbar, setToolbar] = useState<{ x: number; y: number; range: Range } | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<number | null>(null);
  const [popoverHighlightId, setPopoverHighlightId] = useState<number | null>(null);
  const rangesRef = useRef<Map<number, Range[]>>(new Map());

  const articleIdStr = String(articleId);

  const fetchHighlights = useCallback(async () => {
    const list = await HighlightsService.listArticleHighlights(articleIdStr);
    const withComments = await Promise.all(
      list.map(async (h) => {
        const comments = h.commentCount && h.commentCount > 0
          ? await HighlightsService.listHighlightComments(articleIdStr, String(h.id))
          : [];
        return { ...h, comments } as HighlightItem;
      })
    );
    setHighlights(withComments);
  }, [articleIdStr]);

  useEffect(() => {
    fetchHighlights().catch((err) => console.error('Failed to load highlights:', err));
  }, [fetchHighlights]);

  // Register CSS highlights and compute comment-icon positions whenever the set
  // of highlights or the layout changes.
  useLayoutEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const rangeMap = new Map<number, Range[]>();
    const allRanges: Range[] = [];
    for (const h of highlights) {
      const range = locateQuote({ exact: h.exact, prefix: h.prefix, suffix: h.suffix }, container);
      if (range) {
        rangeMap.set(h.id, [range]);
        allRanges.push(range);
      }
    }
    rangesRef.current = rangeMap;

    if (HIGHLIGHTS_SUPPORTED && HighlightCtor && cssHighlights) {
      if (allRanges.length > 0) {
        cssHighlights.set('article-highlight', new HighlightCtor(...allRanges));
      } else {
        cssHighlights.delete('article-highlight');
      }
    }

    // Comment icons at the end of each highlight that has comments.
    const positions: Record<number, { x: number; y: number }> = {};
    for (const h of highlights) {
      if (!h.comments.length) continue;
      const ranges = rangeMap.get(h.id);
      if (!ranges || !ranges.length) continue;
      const rects = ranges[ranges.length - 1].getClientRects();
      const last = rects[rects.length - 1];
      if (last) {
        positions[h.id] = { x: last.right, y: last.top };
      }
    }
    setIconPositions(positions);
  }, [highlights, layoutTick, contentRef]);

  // Recompute icon positions on scroll / resize (ranges themselves follow layout).
  useEffect(() => {
    let raf = 0;
    const bump = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setLayoutTick((t) => t + 1));
    };
    window.addEventListener('scroll', bump, true);
    window.addEventListener('resize', bump);
    const ro = new ResizeObserver(bump);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', bump, true);
      window.removeEventListener('resize', bump);
      ro.disconnect();
    };
  }, [contentRef]);

  // Show the "Highlight" toolbar when the user selects text inside the body.
  useEffect(() => {
    const onSelectionChange = () => {
      const container = contentRef.current;
      const selection = window.getSelection();
      if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
        setToolbar(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setToolbar(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setToolbar(null);
        return;
      }
      setToolbar({ x: rect.left + rect.width / 2, y: rect.top, range: range.cloneRange() });
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [contentRef]);

  // Clicking highlighted text opens the action sheet for that highlight.
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const onClick = (e: MouseEvent) => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return; // active selection -> toolbar handles it
      const x = e.clientX;
      const y = e.clientY;
      for (const [highlightId, ranges] of rangesRef.current.entries()) {
        for (const range of ranges) {
          for (const rect of Array.from(range.getClientRects())) {
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
              setActiveHighlightId(highlightId);
              setPopoverHighlightId(null);
              return;
            }
          }
        }
      }
    };
    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [contentRef]);

  const createHighlight = useCallback(async () => {
    const container = contentRef.current;
    if (!container || !toolbar) return;
    const quote = computeQuote(toolbar.range, container);
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
    if (!quote) return;
    await HighlightsService.createArticleHighlight(articleIdStr, quote);
    await fetchHighlights();
  }, [contentRef, toolbar, articleIdStr, fetchHighlights]);

  const removeHighlight = useCallback(
    async (highlightId: number) => {
      if (!window.confirm('Remove this highlight and its comments?')) return;
      await HighlightsService.deleteArticleHighlight(articleIdStr, String(highlightId));
      setActiveHighlightId(null);
      await fetchHighlights();
    },
    [articleIdStr, fetchHighlights]
  );

  const addComment = useCallback(
    async (highlightId: number, bodyMd: string) => {
      await HighlightsService.createHighlightComment(articleIdStr, String(highlightId), { bodyMd });
      await fetchHighlights();
      onLinksRefresh?.();
    },
    [articleIdStr, fetchHighlights, onLinksRefresh]
  );

  const updateComment = useCallback(
    async (highlightId: number, commentId: number, bodyMd: string) => {
      await HighlightsService.updateHighlightComment(articleIdStr, String(highlightId), String(commentId), { bodyMd });
      await fetchHighlights();
      onLinksRefresh?.();
    },
    [articleIdStr, fetchHighlights, onLinksRefresh]
  );

  const deleteComment = useCallback(
    async (highlightId: number, commentId: number) => {
      await HighlightsService.deleteHighlightComment(articleIdStr, String(highlightId), String(commentId));
      await fetchHighlights();
    },
    [articleIdStr, fetchHighlights]
  );

  const activeHighlight = highlights.find((h) => h.id === activeHighlightId) ?? null;
  const popoverHighlight = highlights.find((h) => h.id === popoverHighlightId) ?? null;
  const popoverPos = popoverHighlightId != null ? iconPositions[popoverHighlightId] : undefined;

  return (
    <>
      {/* Selection toolbar */}
      {toolbar && (
        <div
          className="fixed z-40 -translate-x-1/2 -translate-y-full"
          style={{ left: toolbar.x, top: toolbar.y - 8 }}
        >
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={createHighlight}
            className="flex items-center gap-1 rounded-md bg-github-green-600 px-3 py-1.5 text-sm font-medium text-white shadow-lg hover:bg-github-green-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Highlight
          </button>
        </div>
      )}

      {/* Comment icons at the end of highlighted text */}
      {Object.entries(iconPositions).map(([id, pos]) => (
        <button
          key={id}
          className="fixed z-30 flex h-5 w-5 -translate-y-1 items-center justify-center rounded-full bg-github-green-600 text-white shadow hover:bg-github-green-700"
          style={{ left: pos.x + 2, top: pos.y }}
          title="View comment"
          onClick={() => {
            setPopoverHighlightId((cur) => (cur === Number(id) ? null : Number(id)));
            setActiveHighlightId(null);
          }}
        >
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 16 16">
            <path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12H4v2.25a.5.5 0 0 0 .82.384L8.2 12H13.5A1.5 1.5 0 0 0 15 10.5v-7A1.5 1.5 0 0 0 13.5 2Z" />
          </svg>
        </button>
      ))}

      {/* Comment quick-view popover (from the inline icon) */}
      {popoverHighlight && popoverPos && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setPopoverHighlightId(null)} />
          <div
            className="fixed z-40 max-h-72 w-72 overflow-auto rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
            style={{ left: Math.min(popoverPos.x, window.innerWidth - 300), top: popoverPos.y + 20 }}
          >
            <p className="mb-2 border-l-2 border-github-green-500 pl-2 text-xs italic text-gray-500">
              {popoverHighlight.exact}
            </p>
            <div className="space-y-2">
              {popoverHighlight.comments.map((c) => (
                <div key={c.id} className="prose prose-sm max-w-none text-sm">
                  <MarkdownRenderer content={c.bodyMd} onIssueLinkClick={onIssueLinkClick} />
                </div>
              ))}
            </div>
            <button
              className="mt-2 text-xs font-medium text-github-green-700 hover:underline"
              onClick={() => {
                setActiveHighlightId(popoverHighlight.id);
                setPopoverHighlightId(null);
              }}
            >
              Open
            </button>
          </div>
        </>
      )}

      {/* Highlight action sheet */}
      {activeHighlight && (
        <HighlightActionSheet
          highlight={activeHighlight}
          onClose={() => setActiveHighlightId(null)}
          onRemove={() => removeHighlight(activeHighlight.id)}
          onAddComment={(body) => addComment(activeHighlight.id, body)}
        />
      )}

      {/* Bottom-of-article timeline: quote + comments per highlight */}
      {highlights.some((h) => h.comments.length > 0) && (
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Highlights &amp; Comments
          </h3>
          <div className="space-y-5">
            {highlights
              .filter((h) => h.comments.length > 0)
              .map((h) => (
                <div key={h.id} className="border-l-2 border-github-green-400 pl-3">
                  <blockquote className="mb-2 text-sm italic text-gray-600">“{h.exact}”</blockquote>
                  <div className="space-y-2">
                    {h.comments.map((c) => (
                      <EditableContent
                        key={c.id}
                        content={c.bodyMd}
                        createdAt={c.createdAt}
                        updatedAt={c.updatedAt}
                        onSave={(body) => updateComment(h.id, c.id, body)}
                        onDelete={() => deleteComment(h.id, c.id)}
                        onIssueLinkClick={onIssueLinkClick}
                      />
                    ))}
                  </div>
                  <div className="mt-2">
                    <InlineCommentForm onSubmit={(body) => addComment(h.id, body)} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}

function HighlightActionSheet({
  highlight,
  onClose,
  onRemove,
  onAddComment,
}: {
  highlight: HighlightItem;
  onClose: () => void;
  onRemove: () => void;
  onAddComment: (bodyMd: string) => Promise<void>;
}) {
  const [commenting, setCommenting] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl border border-gray-200 bg-white p-4 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
        <blockquote className="mb-4 border-l-2 border-github-green-500 pl-3 text-sm italic text-gray-600">
          “{highlight.exact}”
        </blockquote>
        {commenting ? (
          <InlineCommentForm
            autoFocus
            onSubmit={async (body) => {
              await onAddComment(body);
              setCommenting(false);
              onClose();
            }}
            onCancel={() => setCommenting(false)}
          />
        ) : (
          <div className="flex flex-col gap-1">
            <button
              className="rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setCommenting(true)}
            >
              Add Comment
            </button>
            <button
              className="rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => copy(highlight.exact)}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              className="rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
              onClick={onRemove}
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function InlineCommentForm({
  onSubmit,
  onCancel,
  autoFocus = false,
}: {
  onSubmit: (bodyMd: string) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const submit = async () => {
    if (!value.trim() || saving) return;
    try {
      setSaving(true);
      await onSubmit(value);
      setValue('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <MarkdownTextarea
        textareaRef={textareaRef}
        value={value}
        onChange={setValue}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        minHeightClass="min-h-[52px]"
        placeholder="Add a comment..."
      />
      <div className="mt-2 flex justify-end gap-2">
        {onCancel && (
          <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
        <button
          className="rounded-md bg-github-green-600 px-3 py-1 text-sm text-white hover:bg-github-green-700 disabled:opacity-50"
          onClick={submit}
          disabled={!value.trim() || saving}
        >
          {saving ? 'Saving...' : 'Comment'}
        </button>
      </div>
    </div>
  );
}
