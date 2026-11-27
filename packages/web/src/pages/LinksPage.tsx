import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProjectsService } from '../api';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { FilterDropdown, FilterOption, ToggleFilterButton } from '../components/FilterControls';
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
import { LINK_TYPES, parseLinksUrl, setLinksRoot } from '../utils/linksUrl';
import { sortProjectsByStatus } from '../utils/projectStatus';
import { updateLabelParam } from '../utils/urlFilterHelpers';

const LinksGraphCanvas = lazy(() => import('../components/LinksGraphCanvas'));
const controlClass = 'rounded-md bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200';

const linkTypeNames = { parent: 'parent / child', derived_from: 'derived_from', relates: 'relates' };

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
  const { query, labels, projects, linkTypes, showOrphans, showArrows, invalidKeys } = parseLinksUrl(params);
  const { rootId, depth, includeLabels } = query;
  const { graph: loaded, loading, reload, error } = useLinksGraph(query, invalidKeys.size === 0);
  const linkTypeKey = [...linkTypes].join(',');
  // 表示フィルタ。到達判定の後に適用し、選んだ種類の保存済みリンクとその両端の Issue を描く。
  const graph = useMemo(() => {
    if (!loaded || (!linkTypeKey && showOrphans)) return loaded;
    const shown = new Set(linkTypeKey ? linkTypeKey.split(',') : LINK_TYPES);
    const edges = loaded.edges.filter(edge => shown.has(edge.linkType === 'child' ? 'parent' : edge.linkType));
    // 表示するリンクを持つ Issue だけを残す。起点は他のフィルタと同じく常に残す。
    const kept = new Set(edges.flatMap(edge => [edge.sourceIssueId, edge.targetIssueId]));
    if (loaded.rootId !== null) kept.add(loaded.rootId);
    const memberships = loaded.memberships.filter(membership => kept.has(membership.issueId));
    const labelIds = new Set(memberships.map(membership => membership.labelId));
    return {
      ...loaded, edges, memberships,
      nodes: loaded.nodes.filter(node => kept.has(node.id)),
      labels: loaded.labels.filter(label => labelIds.has(label.id)),
    };
  }, [loaded, linkTypeKey, showOrphans]);
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

  function toggleLinkType(value: typeof LINK_TYPES[number]) {
    if (linkTypes.has(value)) linkTypes.delete(value);
    else linkTypes.add(value);
    setParam('linkType', LINK_TYPES.filter(type => linkTypes.has(type)).join(','));
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
            <FilterDropdown label={linkTypes.size > 0 ? `Link type: ${[...linkTypes].map(type => linkTypeNames[type]).join(', ')}` : 'Link type'}
              active={linkTypes.size > 0} onClear={() => setParam('linkType')} panelClassName="min-w-[200px]">
              {LINK_TYPES.map(type => (
                <FilterOption key={type} selected={linkTypes.has(type)} onToggle={() => toggleLinkType(type)}>
                  <span className="text-gray-700">{linkTypeNames[type]}</span>
                </FilterOption>
              ))}
            </FilterDropdown>
            <ToggleFilterButton active={showOrphans}
              onToggle={() => setParam('orphans', showOrphans ? 'false' : undefined)}>Orphans</ToggleFilterButton>
            <ToggleFilterButton active={showArrows}
              onToggle={() => setParam('arrows', showArrows ? 'false' : undefined)}>Arrows</ToggleFilterButton>
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
            <LinksGraphCanvas graph={graph} arrows={showArrows} selectedId={selected?.id} onSelect={node => setSelection({ scope, node })} />
          </Suspense>
        ) : loading && <LoadingState message="Loading graph..." />}
      </ListPageLayout>
      <ItemDetailPanel itemId={selected?.id ?? null} itemType={selected?.type ?? null}
        onClose={() => setSelection(current => current === selection ? undefined : current)}
        onItemUpdated={reload} />
    </>
  );
}
