import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer, InlineMarkdownRenderer, extractPreview, stripArticleBlockIds } from '../../src/utils/markdown';

describe('stripArticleBlockIds', () => {
  it('removes extractor block anchors without changing surrounding markdown', () => {
    expect(stripArticleBlockIds('First {#block-17}\n\n## Next {#block-18}')).toBe('First \n\n## Next ');
  });

  it('leaves similar non-anchor text unchanged', () => {
    expect(stripArticleBlockIds('Example {#block-x} and block-17')).toBe('Example {#block-x} and block-17');
  });
});

describe('MarkdownRenderer list alignment', () => {
  // list-inside だと折り返し行がマーカーの下に回り込むため、list-outside + padding を使う（GitHub同等）
  it('renders unordered lists with outside markers and padding', () => {
    const { container } = render(<MarkdownRenderer content={'- item one\n- item two'} />);

    const ul = container.querySelector('ul');
    expect(ul).not.toBeNull();
    expect(ul!.className).toContain('list-outside');
    expect(ul!.className).toContain('pl-6');
    expect(ul!.className).not.toContain('list-inside');
  });

  it('renders ordered lists with outside markers and padding', () => {
    const { container } = render(<MarkdownRenderer content={'1. first\n2. second'} />);

    const ol = container.querySelector('ol');
    expect(ol).not.toBeNull();
    expect(ol!.className).toContain('list-outside');
    expect(ol!.className).toContain('pl-6');
    expect(ol!.className).not.toContain('list-inside');
  });

  it('does not add extra margin to list items (indent is handled by the list padding)', () => {
    const { container } = render(
      <MarkdownRenderer content={'- outer\n  1. nested numbered item\n- outer two'} />
    );

    const items = container.querySelectorAll('li');
    expect(items.length).toBeGreaterThan(0);
    items.forEach((li) => {
      expect(li.className).not.toContain('ml-4');
    });

    // ネストした番号付きリストが li の内側に描画される
    const nestedOl = container.querySelector('li ol');
    expect(nestedOl).not.toBeNull();
  });
});

describe('InlineMarkdownRenderer blockquote', () => {
  it('renders blockquotes without italic styling', () => {
    const { container } = render(<InlineMarkdownRenderer content={'> quoted text'} />);

    expect(screen.getByText('quoted text')).toBeInTheDocument();
    const spans = Array.from(container.querySelectorAll('span'));
    const quote = spans.find((s) => s.className.includes('border-l-2'));
    expect(quote).toBeDefined();
    expect(quote!.className).not.toContain('italic');
  });

  it('renders content after a blockquote', () => {
    const { container } = render(
      <InlineMarkdownRenderer content={'> quoted text\n\nfollowing paragraph'} />
    );

    expect(screen.getByText('quoted text')).toBeInTheDocument();
    expect(screen.getByText('following paragraph')).toBeInTheDocument();
    // 引用と後続段落は別ブロックとして描画される
    const quote = Array.from(container.querySelectorAll('span')).find((s) =>
      s.className.includes('border-l-2')
    );
    expect(quote!.textContent).not.toContain('following paragraph');
  });
});

describe('extractPreview', () => {
  it('keeps newlines so block structure survives', () => {
    const md = '> quote line\n\nsecond paragraph';
    expect(extractPreview(md, 300)).toBe(md);
  });

  it('returns short content unchanged', () => {
    expect(extractPreview('hello', 300)).toBe('hello');
  });

  it('truncates long content with ellipsis', () => {
    const md = 'a'.repeat(400);
    const preview = extractPreview(md, 300);
    expect(preview).toBe('a'.repeat(300) + '...');
  });

  it('trims surrounding whitespace', () => {
    expect(extractPreview('  hello  \n', 300)).toBe('hello');
  });
});
