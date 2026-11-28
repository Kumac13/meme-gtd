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

describe('MarkdownRenderer GFM tables', () => {
  const originalComment = '1 | 2  | 3\n— | — | —\nhoge | fuga | piyo';
  const updatedComment = '1 | 2  | 3\n—- | —- | —-\nhoge | fuga | piyo';

  it.each([originalComment, updatedComment])('renders the comment with an em dash delimiter and no outer pipes: %j', (comment) => {
    render(<MarkdownRenderer content={comment} />);

    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['1', '2', '3']);
    expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['hoge', 'fuga', 'piyo']);
  });

  it.each([originalComment, updatedComment])('keeps em dashes in prose, incompatible column counts, and fenced source: %j', (comment) => {
    const markdown = [
      'Before — after',
      '',
      'Left | Right',
      '— | — | —',
      '',
      '```markdown',
      comment,
      '```',
    ].join('\n');
    const { container } = render(<MarkdownRenderer content={markdown} />);

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Before — after')).toBeInTheDocument();
    expect(screen.getByText('Left | Right — | — | —')).toBeInTheDocument();
    expect(container.querySelector('pre')?.textContent).toContain(comment);
  });

  it('keeps em dash data cells and resolves links defined outside the table', () => {
    render(<MarkdownRenderer content={'First | Second\n| — | — |\n— | —\n[Docs][docs] | Link\n\n[docs]: https://example.com'} />);

    expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['—', '—', 'Docs', 'Link']);
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', 'https://example.com');
  });

  it('renders matching header and body columns with empty cells, safe alignment, and inline markup', () => {
    const lines = [
      '| Left | Center | Right |',
      '| :--- | :---: | ---: |',
      '| **bold** | A\\|B | `x\\|y` |',
      '| *italic* ||',
      '| | | |',
    ];
    const { container } = render(<MarkdownRenderer content={lines.join('\n')} />);

    const table = screen.getByRole('table');
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((cell) => cell.textContent)).toEqual(['Left', 'Center', 'Right']);
    expect(headers.map((cell) => cell.style.textAlign)).toEqual(['left', 'center', 'right']);
    expect(table.parentElement).toHaveClass('overflow-x-auto', 'max-w-full');

    const rows = [...table.querySelectorAll('tbody tr')];
    expect(rows.map((row) => [...row.cells].map((cell) => cell.textContent))).toEqual([
      ['bold', 'A|B', 'x|y'],
      ['italic', '', ''],
      ['', '', ''],
    ]);
    expect([...rows[0].cells].map((cell) => cell.style.textAlign)).toEqual(['left', 'center', 'right']);
    expect(container.querySelector('td strong')).toHaveTextContent('bold');
    expect(container.querySelector('td em')).toHaveTextContent('italic');
    expect(container.querySelector('td code')).toHaveTextContent('x|y');
  });

  it('keeps the existing issue and external link behavior inside and outside tables', () => {
    const onIssueLinkClick = vi.fn();
    const lines = [
      '[Outside task](/tasks/12) [Outside web](https://example.com/outside)',
      '',
      '| Link | Web |',
      '| --- | --- |',
      '| [Inside memo](/memos/34) | [Inside web](https://example.com/inside) |',
    ];
    render(<MarkdownRenderer content={lines.join('\n')} onIssueLinkClick={onIssueLinkClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Outside task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inside memo' }));
    expect(onIssueLinkClick.mock.calls).toEqual([[12, 'task'], [34, 'memo']]);
    for (const path of ['Outside', 'Inside']) {
      const link = screen.getByRole('link', { name: path + ' web' });
      expect(link).toHaveAttribute('href', 'https://example.com/' + path.toLowerCase());
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('sanitizes HTML and URL attributes in cells with the shared pipeline', () => {
    const lines = [
      '| Markup | Destination |',
      '| --- | --- |',
      '| <strong style="color:red" onclick="example()">safe markup</strong> | [Local file](file:///example) |',
      '',
      '<table><tbody><tr><td align="invalid" style="color:red">HTML cell</td></tr></tbody></table>',
    ];
    const { container } = render(<MarkdownRenderer content={lines.join('\n')} />);

    const strong = screen.getByText('safe markup');
    expect(strong.tagName).toBe('STRONG');
    expect(strong).not.toHaveAttribute('onclick');
    expect(strong).not.toHaveAttribute('style');
    expect(container.querySelector('td a')).not.toHaveAttribute('href');
    expect(screen.getByText('HTML cell').style.textAlign).toBe('left');
    expect(screen.getByText('HTML cell').style.color).toBe('');
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

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

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

  it('adds titles to number-only references inside table cells', () => {
    const titles = getIssueReferenceTitles([makeLink(12, 'task', 'A task')]);
    const content = '| Ref | Other |\n| --- | --- |\n| [#12](/tasks/12) | [Custom](/tasks/12) [#17](/tasks/17) |';
    render(<MemoryRouter><MarkdownRenderer content={content} issueReferenceTitles={titles} /></MemoryRouter>);

    const table = screen.getByRole('table');
    expect(within(table).getByRole('link', { name: '#12: A task' })).toHaveAttribute('href', '/tasks/12');
    expect(within(table).getByRole('link', { name: 'Custom' })).toHaveAttribute('href', '/tasks/12');
    expect(within(table).getByRole('link', { name: '#17' })).toHaveAttribute('href', '/tasks/17');
  });

  it('keeps number fallbacks, custom labels, code, external links and other renderers intact', () => {
    const available = makeLink(12, 'task', 'A task');
    const titles = getIssueReferenceTitles([
      available,
      makeLink(14, 'task', '  '),
      makeLink(15, 'task', 'Issue #15'),
      { ...makeLink(17, 'task', ''), targetIssue: undefined } as unknown as LinkDisplayItem,
    ]);
    const content = [
      '[#14](/tasks/14) [#15](/tasks/15) [#17](/tasks/17) [#18](/memos/18)',
      '[#12](/memos/12) [#99](/tasks/12) [Custom](/tasks/12) [#12](https://example.com/tasks/12)',
      '`[#12](/tasks/12)` and #12',
    ].join('\n\n');
    const { rerender } = render(
      <MemoryRouter><MarkdownRenderer content={content} issueReferenceTitles={titles} /></MemoryRouter>,
    );

    for (const id of [14, 15, 17, 18, 99]) {
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

  it('keeps legitimate titles that resemble a missing-target placeholder', () => {
    const task = makeLink(21, 'task', 'Issue #21');
    const titles = getIssueReferenceTitles([
      { ...task, targetIssue: { ...task.targetIssue, status: 'open' } },
      makeLink(22, 'memo', 'Preview (deleted)'),
      makeLink(23, 'memo', 'Issue #23'),
      makeLink(24, 'article', 'Issue #24'),
      makeLink(25, 'article', 'Article (deleted)'),
    ]);
    render(
      <MemoryRouter>
        <MarkdownRenderer
          content="[#21](/tasks/21) [#22](/memos/22) [#23](/memos/23) [#24](/articles/24) [#25](/articles/25)"
          issueReferenceTitles={titles}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '#21: Issue #21' })).toHaveAttribute('href', '/tasks/21');
    expect(screen.getByRole('link', { name: '#22: Preview (deleted)' })).toHaveAttribute('href', '/memos/22');
    expect(screen.getByRole('link', { name: '#23: Issue #23' })).toHaveAttribute('href', '/memos/23');
    expect(screen.getByRole('link', { name: '#24: Issue #24' })).toHaveAttribute('href', '/articles/24');
    expect(screen.getByRole('link', { name: '#25: Article (deleted)' })).toHaveAttribute('href', '/articles/25');
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
    const task = makeLink(12, 'task', 'Initial task (deleted)');
    const article = makeLink(13, 'article', 'New article');
    const createdAt = '2026-11-27T00:00:00';
    const memo = { id: 1, bodyMd: '[#12](/tasks/12)', title: null, isBookmarked: false, createdAt, updatedAt: createdAt };
    const reply = { id: 2, issueId: 1, bodyMd: '[#13](/articles/13)', createdAt, updatedAt: createdAt };
    let posted = false;
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/issues/1/links') return jsonResponse(posted ? [task, article] : [task]);
      if (url === '/api/memos/1') return jsonResponse(memo);
      if (url === '/api/memos/1/comments') {
        if (init?.method === 'POST') {
          posted = true;
          return jsonResponse(reply);
        }
        return jsonResponse(posted ? [reply] : []);
      }
      return jsonResponse([]);
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
      expect(renderedTitles('#12: Initial task (deleted)')).toHaveLength(2);
      expect(screen.getByRole('button', { name: '#12: Initial task (deleted)' })).toBeInTheDocument();
    });
    expect(issueRequests()).toHaveLength(1);

    const [mobileComposer] = screen.getAllByPlaceholderText('Write a comment...');
    fireEvent.change(mobileComposer, { target: { value: '#13' } });
    fireEvent.keyDown(mobileComposer, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(renderedTitles('#13: New article')).toHaveLength(2));
    expect(issueRequests()).toHaveLength(2);
  });

  it('keeps the next Memo and its reference titles after the previous Memo finishes saving', async () => {
    const createdAt = '2026-11-27T00:00:00';
    const fields = { title: null, isBookmarked: false, createdAt, updatedAt: createdAt };
    const memoA = { ...fields, id: 1, bodyMd: 'Memo A body' };
    const memoB = { ...fields, id: 2, bodyMd: 'Memo B body [#12](/tasks/12)' };
    const reply = { id: 30, issueId: 1, bodyMd: '[#2](/memos/2)', createdAt, updatedAt: createdAt };
    let finishSave!: (value: Response) => void;
    const saveResponse = new Promise<Response>(resolve => { finishSave = resolve; });
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/memos/1') return init?.method === 'PATCH' ? saveResponse : jsonResponse(memoA);
      if (url === '/api/memos/2') return jsonResponse(memoB);
      if (url === '/api/memos/1/comments') return jsonResponse([reply]);
      if (url === '/api/issues/1/links') return jsonResponse([makeLink(2, 'memo', 'Open Memo B')]);
      if (url === '/api/issues/2/links') return jsonResponse([{ ...makeLink(12, 'task', 'Task title'), sourceIssueId: 2 }]);
      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetch);

    render(
      <MemoryRouter initialEntries={['/memos/1']}>
        <Routes><Route path="/memos/:id" element={<MemoDetail />} /></Routes>
      </MemoryRouter>,
    );
    const [openMemoB] = await screen.findAllByRole('link', { name: '#2: Open Memo B' });
    const [bodyMenu] = screen.getAllByRole('button', { name: 'More options' });
    fireEvent.click(bodyMenu);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue(memoA.bodyMd), { target: { value: 'Updated Memo A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/memos/1', expect.objectContaining({ method: 'PATCH' })));

    fireEvent.click(openMemoB);
    await screen.findAllByRole('link', { name: '#12: Task title' });
    await act(async () => {
      finishSave(jsonResponse({ ...memoA, bodyMd: 'Updated Memo A' }));
    });

    expect(screen.getAllByRole('link', { name: '#12: Task title' })).toHaveLength(2);
    expect(screen.getAllByText('Memo B body', { exact: false })).toHaveLength(2);
    expect(screen.queryByText('Loading memo...')).toBeNull();
    expect(screen.queryByText('Updated Memo A')).toBeNull();
  });

});
