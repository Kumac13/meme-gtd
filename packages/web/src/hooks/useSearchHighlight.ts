import { useEffect, type RefObject } from 'react';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ATTR = 'data-search-highlight';

function clearHighlights(container: HTMLElement) {
  container.querySelectorAll(`mark[${ATTR}]`).forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    }
  });
}

/**
 * Highlight search keywords in a DOM container by wrapping matches in <mark> elements.
 * Cleans up on unmount or when query/content changes.
 */
export function useSearchHighlight(
  containerRef: RefObject<HTMLElement | null>,
  query: string | undefined,
  _highlightName = 'search-match',
  contentKey?: string | number,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!query) {
      clearHighlights(container);
      return;
    }

    // Clear previous highlights before applying new ones
    clearHighlights(container);

    const escaped = escapeRegex(query);
    const regex = new RegExp(escaped, 'gi');

    const treeWalker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
    );

    const nodesToProcess: { node: Text; matches: { index: number; length: number }[] }[] = [];

    let textNode = treeWalker.nextNode() as Text | null;
    while (textNode) {
      const text = textNode.textContent ?? '';
      const matches: { index: number; length: number }[] = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({ index: match.index, length: query.length });
      }
      if (matches.length > 0) {
        nodesToProcess.push({ node: textNode, matches });
      }
      textNode = treeWalker.nextNode() as Text | null;
    }

    for (const { node, matches } of nodesToProcess) {
      const text = node.textContent ?? '';
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      for (const { index, length } of matches) {
        if (index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));
        }
        const mark = document.createElement('mark');
        mark.setAttribute(ATTR, '');
        mark.textContent = text.slice(index, index + length);
        fragment.appendChild(mark);
        lastIndex = index + length;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      node.parentNode?.replaceChild(fragment, node);
    }

    return () => {
      clearHighlights(container);
    };
  }, [containerRef, query, contentKey]);
}
