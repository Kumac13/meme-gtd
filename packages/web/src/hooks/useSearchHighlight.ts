import { useEffect, type RefObject } from 'react';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight search keywords in a DOM container using CSS Custom Highlight API.
 * Falls back gracefully (no highlight) on unsupported browsers.
 * Does NOT mutate the DOM — uses the browser's native highlight layer.
 */
export function useSearchHighlight(
  containerRef: RefObject<HTMLElement | null>,
  query: string | undefined,
  highlightName = 'search-match',
) {
  useEffect(() => {
    if (!CSS.highlights) return;

    if (!containerRef.current || !query) {
      CSS.highlights.delete(highlightName);
      return;
    }

    const ranges: Range[] = [];
    const treeWalker = document.createTreeWalker(
      containerRef.current,
      NodeFilter.SHOW_TEXT,
    );

    const escaped = escapeRegex(query);
    const regex = new RegExp(escaped, 'gi');

    let node = treeWalker.nextNode();
    while (node) {
      const text = node.textContent ?? '';
      let match;
      while ((match = regex.exec(text)) !== null) {
        const range = new Range();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + query.length);
        ranges.push(range);
      }
      node = treeWalker.nextNode();
    }

    if (ranges.length > 0) {
      CSS.highlights.set(highlightName, new Highlight(...ranges));
    } else {
      CSS.highlights.delete(highlightName);
    }

    return () => {
      CSS.highlights.delete(highlightName);
    };
  }, [containerRef, query, highlightName]);
}
