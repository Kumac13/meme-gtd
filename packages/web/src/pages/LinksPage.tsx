import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProjectsService } from '../api';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { FilterDropdown, ToggleFilterButton } from '../components/FilterControls';
import { ItemDetailPanel } from '../components/ItemDetailPanel';
import IssuePicker from '../components/IssuePicker';
import LabelFilterDropdown from '../components/LabelFilterDropdown';
import { ListPageLayout } from '../components/ListPageLayout';
import LoadingState from '../components/LoadingState';
import ProjectFilterDropdown from '../components/ProjectFilterDropdown';
import SearchInput from '../components/SearchInput';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLinksGraph, type LinksGraphData } from '../hooks/useLinksGraph';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { parseLinksUrl, setLinksRoot } from '../utils/linksUrl';
import { sortProjectsByStatus } from '../utils/projectStatus';
import { updateLabelParam } from '../utils/urlFilterHelpers';

const LinksGraphCanvas = lazy(() => import('../components/LinksGraphCanvas'));
const controlClass = 'rounded-md bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200';

function DepthControl({ depth, onChange }: { depth?: number; onChange: (value?: number) => void }) {
  const [draft, setDraft] = useState(depth?.toString() ?? '');
  function submit(event: FormEvent<HTMLFormElement>, close: () => void) {
    event.preventDefault();
    const value = draft ? Number(draft) : undefined;
    if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) return;
    onChange(value);
    close();
  }
  return (
    <FilterDropdown label={depth ? `Depth: ${depth}` : 'Depth'} active={depth !== undefined}
      onClear={() => { setDraft(''); onChange(); }} panelClassName="w-48">
      {close => (
        <form className="flex items-end gap-2 p-3" onSubmit={event => submit(event, close)}>
          <label className="min-w-0 flex-1 text-xs text-gray-600">
            Max links
            <input type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" inputMode="numeric"
              value={draft} onChange={event => setDraft(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <button type="submit" className={controlClass}>Apply</button>
        </form>
      )}
    </FilterDropdown>
  );
}

export default function LinksPage() {
  const [params, setParams] = useSearchParams();
  const { filters, actions } = useUrlFilters();
  const { query, labels, projects, invalidKeys } = parseLinksUrl(params);
  const { rootId, depth, includeLabels } = query;
  const { graph, loading, reload, error } = useLinksGraph(query, invalidKeys.size === 0);
  const [availableProjects, setAvailableProjects] = useState<Awaited<ReturnType<typeof ProjectsService.listProjects>>>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const scope = `${rootId}/${depth}`;
  const [selection, setSelection] = useState<{ scope: string; node: LinksGraphData['nodes'][number] }>();
  const selected = selection?.scope === scope ? selection.node : undefined;
  useDocumentTitle('Links');

  useEffect(() => {
    let active = true;
    const request = ProjectsService.listProjects();
    void request.then(value => {
      if (active) setAvailableProjects(sortProjectsByStatus(value));
    }).catch(error => {
      if (active) console.error('Could not load projects:', error);
    });
    return () => {
      active = false;
      request.cancel();
    };
  }, []);

  function setParam(key: string, value?: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  function toggleProject(value: string) {
    if (projects.has(value)) projects.delete(value);
    else projects.add(value);
    setParam('projectId', [...projects].join(','));
  }

  function chooseRoot(id?: number) {
    setPickerOpen(false);
    setSelection(undefined);
    setParams(setLinksRoot(params, id));
  }

  function resetInvalid() {
    const next = new URLSearchParams(params);
    for (const key of invalidKeys) next.delete(key);
    if (!next.has('rootId')) next.delete('depth');
    setParams(next);
  }

  const root = graph?.nodes.find(node => node.id === rootId);
  const selectedProjectIds = new Set([...projects].filter(value => value !== 'none').map(Number));
  const empty = graph?.nodes.length === 0;
  const rootLabel = root ? `#${root.id} ${root.title}` : `#${rootId}`;

  return (
    <>
      <ListPageLayout
        search={<SearchInput value={filters.searchQuery} onChange={actions.setSearchQuery} placeholder="Search issues" />}
        filters={<>
          <LabelFilterDropdown selectedLabels={labels} countKey="issueCount" onClear={() => setParam('label')}
            onToggle={name => {
              if (labels.has(name)) labels.delete(name);
              else labels.add(name);
              setParams(updateLabelParam(params, labels));
            }} />
          <ProjectFilterDropdown projects={availableProjects} selectedIds={selectedProjectIds}
            includesNoProject={projects.has('none')} label={projects.size > 0 ? `${projects.size} Projects` : 'Project'}
            showWhenEmpty panelWidth="w-[min(280px,calc(100vw-8rem))]" onToggle={id => toggleProject(String(id))} onToggleNoProject={() => toggleProject('none')}
            onClear={() => setParam('projectId')} />
          <ToggleFilterButton active={filters.bookmarked}
            onToggle={() => setParam('bookmarked', filters.bookmarked ? undefined : 'true')}>Bookmarked</ToggleFilterButton>
        </>}
        secondaryFilters={<div className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Starting issue" className="flex max-w-full items-stretch rounded-md bg-gray-100">
              <button type="button" className={`${controlClass} min-w-0 truncate`} title={rootId ? rootLabel : undefined}
                aria-expanded={pickerOpen} aria-label={rootId ? `Change starting issue, ${rootLabel}` : undefined}
                onClick={() => setPickerOpen(value => !value)}>
                {rootId ? `Start: ${rootLabel}` : 'Choose an issue'}
              </button>
              {rootId !== undefined && (
                <button type="button" aria-label="Clear starting issue" title="Clear starting issue"
                  className={`${controlClass} shrink-0 border-l border-gray-200`} onClick={() => chooseRoot()}>×</button>
              )}
            </div>
            {rootId !== undefined && (
              <DepthControl key={scope} depth={depth} onChange={value => setParam('depth', value?.toString())} />
            )}
            <ToggleFilterButton active={includeLabels === 'true'}
              onToggle={() => setParam('includeLabels', includeLabels ? undefined : 'true')}>Label nodes</ToggleFilterButton>
          </div>
          {pickerOpen && <div className="mt-2 max-w-md rounded-md border border-gray-200 bg-white p-3">
            <IssuePicker onSelect={issue => chooseRoot(issue.id)} onCancel={() => setPickerOpen(false)} />
          </div>}
        </div>}
        summary={graph && <span aria-live="polite">{graph.nodes.length} issues · {graph.edges.length} links
          {graph.truncated && <span className="ml-2 font-medium text-amber-800">Partial graph. Use search, filters or Depth to narrow the results.</span>}
        </span>}
        empty={empty}
        emptyState={<EmptyState message="No matching issues" submessage="Change your search or clear a filter." />}
      >
        {invalidKeys.size > 0 ? (
          <div role="alert">
            <ErrorState title="Invalid Links URL" error="Check the starting issue, depth or filter values." />
            <button type="button" className={controlClass} onClick={resetInvalid}>Reset invalid settings</button>
          </div>
        ) : error ? (
          <div role="alert">
            <ErrorState title="Could not show Links" error={error.message} />
            <div className="flex gap-2">
              <button type="button" className={controlClass} onClick={reload}>Retry</button>
              {error.missingRoot && <button type="button" className={controlClass} onClick={() => chooseRoot()}>Show all issues</button>}
            </div>
          </div>
        ) : graph ? (
          <Suspense fallback={<LoadingState message="Loading graph..." />}>
            <LinksGraphCanvas graph={graph} selectedId={selected?.id} onSelect={node => setSelection({ scope, node })} />
          </Suspense>
        ) : loading && <LoadingState message="Loading graph..." />}
      </ListPageLayout>
      <ItemDetailPanel itemId={selected?.id ?? null} itemType={selected?.type ?? null}
        onClose={() => setSelection(current => current === selection ? undefined : current)}
        onItemUpdated={reload} />
    </>
  );
}
