import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticlesService, LinksService, ProjectsService, TasksService } from '../../src/api';
import type { LinksGraphData } from '../../src/hooks/useLinksGraph';
import LinksPage from '../../src/pages/LinksPage';
import { parseLinksUrl, setLinksRoot } from '../../src/utils/linksUrl';

vi.mock('../../src/components/LinksGraphCanvas', () => ({
  default: ({ graph, onSelect }: { graph: LinksGraphData; onSelect: (node: LinksGraphData['nodes'][number]) => void }) => (
    <div>{graph.nodes.map(node => <button key={node.id} onClick={() => onSelect(node)}>{node.title}</button>)}</div>
  ),
}));

vi.mock('../../src/components/ItemDetail', () => ({
  default: ({ item, onUpdate }: { item: { title: string }; onUpdate: (item: { title: string }) => void }) => (
    <button onClick={() => onUpdate({ ...item, title: 'Successfully changed' })}>Save details</button>
  ),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const request = Object.assign(new Promise<T>(finish => { resolve = finish; }), { cancel: vi.fn() });
  return { request, resolve };
}

function graph(rootId: number | null, ...nodes: LinksGraphData['nodes']): LinksGraphData {
  return {
    rootId, nodes, depth: null, edges: [], labels: [], memberships: [], truncated: false,
    limits: { issueNodes: 5000, issueEdges: 20000, labelNodes: 2000, memberships: 20000 },
  };
}

function LocationControls() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="current-links-url">{location.search}</output>
      <button onClick={() => navigate(-1)}>Previous page</button>
      <button onClick={() => navigate(1)}>Next page</button>
    </>
  );
}

function setup(history: string[]) {
  render(<MemoryRouter initialEntries={history}><LinksPage /><LocationControls /></MemoryRouter>);
}

describe('Links page state', () => {
  beforeEach(() => {
    vi.spyOn(ProjectsService, 'listProjects').mockReturnValue(
      Object.assign(Promise.resolve([]), { cancel: vi.fn() }) as ReturnType<typeof ProjectsService.listProjects>,
    );
    globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(
      new Response('[]', { headers: { 'Content-Type': 'application/json' } }),
    ));
  });
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('restores the root, depth and display filters from the URL through back and forward', async () => {
    const get = vi.spyOn(LinksService, 'getLinksGraph').mockImplementation(rootId =>
      Object.assign(Promise.resolve(graph(rootId ?? null)), { cancel: vi.fn() }) as ReturnType<typeof LinksService.getLinksGraph>,
    );
    setup(['/links?rootId=1', '/links?rootId=7&depth=6&q=term&label=blue&projectId=none&bookmarked=true&includeLabels=true']);
    expect(get).toHaveBeenLastCalledWith(7, 6, 'term', 'blue', 'none', 'true', 'true');
    expect(screen.getByPlaceholderText('Search issues')).toHaveValue('term');
    expect(screen.getByRole('button', { name: 'Depth: 6' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(get).toHaveBeenLastCalledWith(1, undefined, undefined, undefined, undefined, undefined, undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(get).toHaveBeenLastCalledWith(7, 6, 'term', 'blue', 'none', 'true', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Clear starting issue' }));
    expect(get).toHaveBeenLastCalledWith(undefined, undefined, 'term', 'blue', 'none', 'true', 'true');
    await waitFor(() => expect(screen.getByText('No matching issues')).toBeVisible());
  });

  it('cancels a superseded graph request and discards an already-completing old response', async () => {
    const older = deferred<LinksGraphData>();
    const current = deferred<LinksGraphData>();
    vi.spyOn(LinksService, 'getLinksGraph')
      .mockReturnValueOnce(older.request as ReturnType<typeof LinksService.getLinksGraph>)
      .mockReturnValueOnce(current.request as ReturnType<typeof LinksService.getLinksGraph>);

    setup(['/links?rootId=21', '/links?rootId=10']);
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(older.request.cancel).toHaveBeenCalledOnce();
    await act(() => current.resolve(graph(21, { id: 21, type: 'memo', title: 'Current graph', status: null })));
    expect(await screen.findByRole('button', { name: 'Current graph' })).toBeVisible();
    await act(() => older.resolve(graph(10, { id: 10, type: 'task', title: 'Outdated graph', status: null })));
    expect(screen.queryByRole('button', { name: 'Outdated graph' })).toBeNull();
  });

  it('keeps the latest detail and reloads the current graph only after a detail update', async () => {
    const older = deferred<Awaited<ReturnType<typeof TasksService.getTask>>>();
    const current = deferred<Awaited<ReturnType<typeof ArticlesService.getArticle>>>();
    vi.spyOn(TasksService, 'getTask').mockReturnValue(older.request as ReturnType<typeof TasksService.getTask>);
    vi.spyOn(ArticlesService, 'getArticle').mockReturnValue(current.request as ReturnType<typeof ArticlesService.getArticle>);
    const response = graph(10,
      { id: 10, type: 'task', title: 'Select task', status: 'open' },
      { id: 21, type: 'article', title: 'Select article', status: null },
    );
    const get = vi.spyOn(LinksService, 'getLinksGraph').mockImplementation(() =>
      Object.assign(Promise.resolve(response), { cancel: vi.fn() }) as ReturnType<typeof LinksService.getLinksGraph>,
    );
    setup(['/links?rootId=10&depth=2']);
    fireEvent.click(await screen.findByRole('button', { name: 'Select task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select article' }));
    expect(older.request.cancel).toHaveBeenCalledOnce();
    await act(() => current.resolve({ id: 21, title: 'Current article' } as Awaited<ReturnType<typeof ArticlesService.getArticle>>));
    expect(screen.getByRole('heading', { name: 'Current article' })).toBeVisible();
    await act(() => older.resolve({ id: 10, title: 'Outdated task' } as Awaited<ReturnType<typeof TasksService.getTask>>));
    expect(screen.queryByRole('heading', { name: 'Outdated task' })).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(screen.getByRole('heading', { name: 'Successfully changed' })).toBeVisible();
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenLastCalledWith(10, 2, undefined, undefined, undefined, undefined, undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('button', { name: 'Select article' })).toBeVisible();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('validates URL recovery and resets depth when switching starting issues', () => {
    const bad = new URLSearchParams('rootId=b&depth=0&projectId=-1&q=kept&bookmarked=true');
    expect([...parseLinksUrl(bad).invalidKeys]).toEqual(['rootId', 'depth', 'projectId']);
    const changed = setLinksRoot(new URLSearchParams('rootId=1&depth=4&q=kept&bookmarked=true'), 8);
    expect(changed.toString()).toBe('rootId=8&q=kept&bookmarked=true');
  });
});
