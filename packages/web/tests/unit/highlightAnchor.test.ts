import { describe, expect, it } from 'vitest';
import { computeQuote, locateQuote, type QuoteSelector } from '../../src/utils/highlightAnchor';

function makeContainer(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

function rangeOverText(container: HTMLElement, needle: string): Range {
  // Find the first text node containing `needle` and build a range over it.
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = node as Text;
    const idx = t.data.indexOf(needle);
    if (idx !== -1) {
      const range = document.createRange();
      range.setStart(t, idx);
      range.setEnd(t, idx + needle.length);
      return range;
    }
  }
  throw new Error(`needle not found: ${needle}`);
}

describe('computeQuote', () => {
  it('captures exact text with surrounding context', () => {
    const container = makeContainer('<p>The quick brown fox jumps over the lazy dog.</p>');
    const range = rangeOverText(container, 'quick brown fox');
    const quote = computeQuote(range, container);
    expect(quote).not.toBeNull();
    expect(quote!.exact).toBe('quick brown fox');
    expect(quote!.prefix).toBe('The ');
    expect(quote!.suffix).toBe(' jumps over the lazy dog.');
  });

  it('returns null for a collapsed (empty) range', () => {
    const container = makeContainer('<p>Hello world</p>');
    const t = container.querySelector('p')!.firstChild as Text;
    const range = document.createRange();
    range.setStart(t, 2);
    range.setEnd(t, 2);
    expect(computeQuote(range, container)).toBeNull();
  });
});

describe('locateQuote round-trip', () => {
  it('locates a quote back to a range with matching text', () => {
    const container = makeContainer('<p>The quick brown fox jumps over the lazy dog.</p>');
    const quote: QuoteSelector = { exact: 'quick brown fox', prefix: 'The ', suffix: ' jumps' };
    const range = locateQuote(quote, container);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('quick brown fox');
  });

  it('spans across block (multiple text node) boundaries', () => {
    const container = makeContainer('<p>Alpha beta gamma</p><p>delta epsilon</p>');
    // "gamma" and "delta" live in different <p> text nodes; the raw concatenation
    // is "Alpha beta gammadelta epsilon".
    const quote: QuoteSelector = { exact: 'gammadelta' };
    const range = locateQuote(quote, container);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('gammadelta');
  });

  it('disambiguates repeated text using prefix/suffix', () => {
    const container = makeContainer('<p>see the cat and the cat again</p>');
    // "the cat" appears twice; suffix " again" pins the second one.
    const first: QuoteSelector = { exact: 'the cat', prefix: 'see ', suffix: ' and' };
    const second: QuoteSelector = { exact: 'the cat', prefix: 'and ', suffix: ' again' };
    expect(locateQuote(first, container)!.startOffset).toBeLessThan(
      locateQuote(second, container)!.startOffset
    );
  });

  it('falls back to whitespace-normalized matching', () => {
    // DOM has a newline+spaces where the stored quote has a single space.
    const container = makeContainer('<p>hello\n    brave   new world</p>');
    const quote: QuoteSelector = { exact: 'brave new world', prefix: 'hello ' };
    const range = locateQuote(quote, container);
    expect(range).not.toBeNull();
    expect(range!.toString().replace(/\s+/g, ' ')).toBe('brave new world');
  });

  it('returns null when the quote is absent', () => {
    const container = makeContainer('<p>nothing to see here</p>');
    expect(locateQuote({ exact: 'missing text' }, container)).toBeNull();
  });
});

describe('computeQuote + locateQuote integration', () => {
  it('a computed quote resolves back to the same text', () => {
    const container = makeContainer('<p>Readability extracts the main article body cleanly.</p>');
    const range = rangeOverText(container, 'main article body');
    const quote = computeQuote(range, container)!;
    const located = locateQuote(quote, container)!;
    expect(located.toString()).toBe('main article body');
  });
});
