import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LinksService } from '../../src/api/services/LinksService';
import { useDetailIssueLinks } from '../../src/hooks/useDetailIssueLinks';
import MemoDetail from '../../src/pages/MemoDetail';
import type { LinkDisplayItem } from '../../src/types/links';
import { getIssueReferenceTitles } from '../../src/utils/issueReferenceTitles';
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

const makeLink = (id: number, type: LinkDisplayItem['targetIssue']['type'], title: string): LinkDisplayItem => ({
  id,
  sourceIssueId: 1,
  targetIssueId: id,
  linkType: 'relates',
  direction: 'outgoing',
  createdAt: '2026-11-27T00:00:00',
  targetIssue: { id, type, title, status: null },
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Detail issue reference titles', () => {
  it('renders both directions, all target types, repeated references and the tail of a large response', () => {
    const task = makeLink(12, 'task', 'Symbols **[draft]** <span> & /');
    const memo = makeLink(13, 'memo', 'Memo preview from Links…');
    const article = makeLink(9001, 'article', 'An article with a long title '.repeat(5));
    const links: LinkDisplayItem[] = [
      task, { ...task, id: 99, linkType: 'parent' }, memo,
      ...Array.from({ length: 3100 }, (_, index) => makeLink(index + 30, 'task', 'Other')),
      { ...article, sourceIssueId: 9001, targetIssueId: 1, direction: 'incoming' },
    ];
    const onIssueLinkClick = vi.fn();
    const content = '[#12](/tasks/12) [#13](/memos/13) [#9001](/articles/9001) [#12](/tasks/12)';
    render(
      <MemoryRouter>
        <MarkdownRenderer content={content} issueReferenceTitles={getIssueReferenceTitles(links)}
          onIssueLinkClick={onIssueLinkClick} />
      </MemoryRouter>,
    );

    const taskLinks = screen.getAllByRole('link', { name: `#12: ${task.targetIssue.title}` });
    expect(taskLinks).toHaveLength(2);
    expect(taskLinks[0]).toHaveAttribute('href', '/tasks/12');
    fireEvent.click(taskLinks[0]);
    expect(onIssueLinkClick).toHaveBeenCalledWith(12, 'task');
    expect(screen.getByRole('link', { name: '#13: Memo preview from Links…' })).toHaveAttribute('href', '/memos/13');
    expect(screen.getByRole('link', { name: `#9001: ${article.targetIssue.title.slice(0, 100)}...` }))
      .toHaveAttribute('href', '/articles/9001');
  });

  it('keeps number fallbacks, custom labels, code, external links and other renderers intact', () => {
    const available = makeLink(12, 'task', 'A task');
    const titles = getIssueReferenceTitles([
      available,
      makeLink(14, 'task', '  '),
      makeLink(15, 'task', 'Issue #15'),
      makeLink(16, 'article', 'Article (deleted)'),
      { ...makeLink(17, 'task', ''), targetIssue: undefined } as unknown as LinkDisplayItem,
    ]);
    const content = [
      '[#14](/tasks/14) [#15](/tasks/15) [#16](/articles/16) [#17](/tasks/17) [#18](/memos/18)',
      '[#12](/memos/12) [#99](/tasks/12) [Custom](/tasks/12) [#12](https://example.com/tasks/12)',
      '`[#12](/tasks/12)` and #12',
    ].join('\n\n');
    const { rerender } = render(
      <MemoryRouter><MarkdownRenderer content={content} issueReferenceTitles={titles} /></MemoryRouter>,
    );

    for (const id of [14, 15, 16, 17, 18, 99]) {
      expect(screen.getByRole('link', { name: `#${id}` })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('link', { name: '#12' }).map(link => link.getAttribute('href')))
      .toEqual(['/memos/12', 'https://example.com/tasks/12']);
    expect(screen.getByRole('link', { name: 'Custom' })).toHaveAttribute('href', '/tasks/12');
    expect(screen.getByText('[#12](/tasks/12)').tagName).toBe('CODE');
    expect(screen.queryByText('#12: A task')).toBeNull();

    rerender(<MemoryRouter><MarkdownRenderer content="[#12](/tasks/12)" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: '#12' })).toHaveAttribute('href', '/tasks/12');
  });

  it('ignores responses from previous detail identities and superseded refreshes', async () => {
    type ResolveLinks = (links: LinkDisplayItem[]) => void;
    const requests: ResolveLinks[] = [];
    vi.spyOn(LinksService, 'listIssueLinks').mockImplementation(
      () => new Promise<LinkDisplayItem[]>(resolve => { requests.push(resolve); }) as ReturnType<typeof LinksService.listIssueLinks>,
    );
    const { result, rerender } = renderHook(({ id }) => useDetailIssueLinks(id, 'task'), { initialProps: { id: 1 } });
    expect(result.current.titles.size).toBe(0);
    rerender({ id: 2 });
    act(() => result.current.refresh());
    await act(async () => requests[2]([makeLink(12, 'task', 'Newest')]));
    expect(result.current.titles.get('task:12')).toBe('Newest');
    await act(async () => {
      requests[1]([makeLink(12, 'task', 'Earlier request')]);
      requests[0]([makeLink(12, 'task', 'Previous detail')]);
    });
    expect(result.current.titles.get('task:12')).toBe('Newest');
  });

  it('shares one response across both Memo detail layouts and reloads after posting a reply', async () => {
    const task = makeLink(12, 'task', 'Initial task');
    const article = makeLink(13, 'article', 'New article');
    const createdAt = '2026-11-27T00:00:00';
    const memo = { id: 1, bodyMd: '[#12](/tasks/12)', title: null, isBookmarked: false, createdAt, updatedAt: createdAt };
    const reply = { id: 2, issueId: 1, bodyMd: '[#13](/articles/13)', createdAt, updatedAt: createdAt };
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    let posted = false;
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/issues/1/links') return json(posted ? [task, article] : [task]);
      if (url === '/api/memos/1') return json(memo);
      if (url === '/api/memos/1/comments') {
        if (init?.method === 'POST') {
          posted = true;
          return json(reply);
        }
        return json(posted ? [reply] : []);
      }
      return json([]);
    });
    vi.stubGlobal('fetch', fetch);
    const { container } = render(
      <MemoryRouter initialEntries={['/memos/1']}>
        <Routes><Route path="/memos/:id" element={<MemoDetail />} /></Routes>
      </MemoryRouter>,
    );
    const renderedTitles = (name: string) => within(container).getAllByText(name, { selector: 'a' });
    const issueRequests = () => fetch.mock.calls.filter(([url]) => url === '/api/issues/1/links');
    await waitFor(() => {
      expect(renderedTitles('#12: Initial task')).toHaveLength(2);
      expect(screen.getByRole('button', { name: '#12: Initial task' })).toBeInTheDocument();
    });
    expect(issueRequests()).toHaveLength(1);

    const [mobileComposer] = screen.getAllByPlaceholderText('Write a comment...');
    fireEvent.change(mobileComposer, { target: { value: '#13' } });
    fireEvent.keyDown(mobileComposer, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(renderedTitles('#13: New article')).toHaveLength(2));
    expect(issueRequests()).toHaveLength(2);
  });
});
