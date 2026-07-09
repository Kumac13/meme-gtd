/**
 * TextQuoteSelector anchoring for article highlights (W3C Web Annotation style).
 *
 * The article body is an immutable snapshot rendered deterministically, so a
 * highlight is anchored by its exact text plus surrounding context (prefix /
 * suffix) rather than by character offsets. This module converts between a DOM
 * Selection Range and a quote, and locates a quote back to a Range for display.
 *
 * Matching runs against the raw concatenated text of the container's text nodes
 * first (identical at create- and display-time for the same rendering). A
 * whitespace-normalized fallback makes a quote created on one client resolvable
 * on another whose rendering differs only in whitespace (e.g. web vs iOS).
 */

export interface QuoteSelector {
  exact: string;
  prefix?: string;
  suffix?: string;
}

/** Number of context characters captured on each side of the quote. */
const CONTEXT_LENGTH = 32;

interface Collected {
  raw: string;
  nodes: Text[];
  starts: number[];
}

function collect(container: Node): Collected {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const starts: number[] = [];
  let raw = '';
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = node as Text;
    nodes.push(t);
    starts.push(raw.length);
    raw += t.data;
  }
  return { raw, nodes, starts };
}

function domPositionToRawOffset(collected: Collected, node: Node, offset: number): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const idx = collected.nodes.indexOf(node as Text);
    if (idx === -1) return null;
    return collected.starts[idx] + offset;
  }
  // Element container position: map to the start of the child text at `offset`.
  const child = node.childNodes[offset] ?? node.childNodes[node.childNodes.length - 1];
  if (!child) return null;
  // Find the first text node at or after `child`.
  for (let i = 0; i < collected.nodes.length; i++) {
    const t = collected.nodes[i];
    const pos = child.compareDocumentPosition(t);
    if (t === child || pos & Node.DOCUMENT_POSITION_CONTAINED_BY || pos & Node.DOCUMENT_POSITION_FOLLOWING || pos === 0) {
      return collected.starts[i];
    }
  }
  return collected.raw.length;
}

function rawOffsetToDom(collected: Collected, offset: number): { node: Text; offset: number } | null {
  const { nodes, starts } = collected;
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (offset >= starts[i]) {
      const local = offset - starts[i];
      if (local <= nodes[i].data.length) return { node: nodes[i], offset: local };
    }
  }
  if (nodes.length) return { node: nodes[0], offset: 0 };
  return null;
}

/**
 * Derive a TextQuoteSelector from a DOM Range within `container`.
 * Returns null if the range is empty or its endpoints are outside the container.
 */
export function computeQuote(range: Range, container: HTMLElement): QuoteSelector | null {
  const collected = collect(container);
  const start = domPositionToRawOffset(collected, range.startContainer, range.startOffset);
  const end = domPositionToRawOffset(collected, range.endContainer, range.endOffset);
  if (start == null || end == null || end <= start) return null;

  const exact = collected.raw.slice(start, end);
  if (!exact.trim()) return null;

  const prefix = collected.raw.slice(Math.max(0, start - CONTEXT_LENGTH), start);
  const suffix = collected.raw.slice(end, end + CONTEXT_LENGTH);
  return {
    exact,
    ...(prefix && { prefix }),
    ...(suffix && { suffix }),
  };
}

/** Collapse runs of whitespace to a single space, keeping a map back to raw indices. */
function normalizeWithMap(raw: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  let prevWasSpace = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (/\s/.test(ch)) {
      if (prevWasSpace) continue;
      norm += ' ';
      map.push(i);
      prevWasSpace = true;
    } else {
      norm += ch;
      map.push(i);
      prevWasSpace = false;
    }
  }
  return { norm, map };
}

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ');
}

/**
 * Find the raw [start, end) offsets of a quote in `raw`, disambiguating repeated
 * text by prefix/suffix context. Returns null if not found.
 */
function findQuoteOffsets(raw: string, anchor: QuoteSelector): [number, number] | null {
  const { exact, prefix = '', suffix = '' } = anchor;
  if (!exact) return null;

  // 1. prefix + exact + suffix as a single contiguous match (most precise).
  if (prefix || suffix) {
    const combined = prefix + exact + suffix;
    const at = raw.indexOf(combined);
    if (at !== -1) {
      const start = at + prefix.length;
      return [start, start + exact.length];
    }
  }

  // 2. All occurrences of exact, scored by surrounding context.
  const occurrences: number[] = [];
  let from = 0;
  for (;;) {
    const at = raw.indexOf(exact, from);
    if (at === -1) break;
    occurrences.push(at);
    from = at + 1;
  }
  if (occurrences.length === 1) {
    return [occurrences[0], occurrences[0] + exact.length];
  }
  if (occurrences.length > 1) {
    let best = occurrences[0];
    let bestScore = -1;
    for (const at of occurrences) {
      const before = raw.slice(Math.max(0, at - prefix.length), at);
      const after = raw.slice(at + exact.length, at + exact.length + suffix.length);
      let score = 0;
      if (prefix && before.endsWith(prefix)) score += prefix.length;
      if (suffix && after.startsWith(suffix)) score += suffix.length;
      if (score > bestScore) {
        bestScore = score;
        best = at;
      }
    }
    return [best, best + exact.length];
  }

  return null;
}

/**
 * Locate a quote within `container` and return a DOM Range spanning it, or null
 * if it cannot be found (the highlight is then simply not rendered).
 */
export function locateQuote(anchor: QuoteSelector, container: HTMLElement): Range | null {
  const collected = collect(container);

  let offsets = findQuoteOffsets(collected.raw, anchor);

  // Whitespace-normalized fallback (cross-renderer robustness).
  if (!offsets) {
    const { norm, map } = normalizeWithMap(collected.raw);
    const normAnchor: QuoteSelector = {
      exact: normalize(anchor.exact),
      ...(anchor.prefix && { prefix: normalize(anchor.prefix) }),
      ...(anchor.suffix && { suffix: normalize(anchor.suffix) }),
    };
    const normOffsets = findQuoteOffsets(norm, normAnchor);
    if (normOffsets) {
      const [ns, ne] = normOffsets;
      // Map normalized offsets back to raw. `map` has one entry per normalized char.
      const rawStart = map[ns] ?? 0;
      const rawEnd = ne < map.length ? map[ne] : collected.raw.length;
      offsets = [rawStart, rawEnd];
    }
  }

  if (!offsets) return null;

  const startPos = rawOffsetToDom(collected, offsets[0]);
  const endPos = rawOffsetToDom(collected, offsets[1]);
  if (!startPos || !endPos) return null;

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  return range;
}
