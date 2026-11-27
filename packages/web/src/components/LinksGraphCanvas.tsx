import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import cytoscape, { type BoundingBox12, type Core, type ElementDefinition, type NodeSingular, type Position, type StylesheetStyle } from 'cytoscape';
import type { LinksGraphData } from '../hooks/useLinksGraph';

type IssueNode = LinksGraphData['nodes'][number];
type LinkType = LinksGraphData['edges'][number]['linkType'];

const issueColors = { task: '#2563eb', memo: '#7c3aed', article: '#c2410c' };
const relationships: Record<LinkType, { color: string; outgoing: string; incoming: string; legend: string }> = {
  parent: { color: '#2563eb', outgoing: 'Parent of', incoming: 'Child of', legend: 'Parent → child' },
  child: { color: '#7c3aed', outgoing: 'Child of', incoming: 'Parent of', legend: 'Child → parent' },
  derived_from: { color: '#b45309', outgoing: 'Derived from', incoming: 'Source of', legend: 'Derived → source' },
  relates: { color: '#64748b', outgoing: 'Relates to', incoming: 'Related from', legend: 'Relates' },
};

const styles: StylesheetStyle[] = [
  { selector: 'node', style: { width: 20, height: 20, 'background-color': 'data(color)' } },
  { selector: 'node.issue', style: {
    label: 'data(shortTitle)', 'text-valign': 'bottom', 'text-margin-y': 4, 'font-size': 11,
    'text-max-width': '112px', 'text-wrap': 'ellipsis', color: '#1f2937',
    'text-background-color': '#ffffff', 'text-background-opacity': 0.9, 'text-background-padding': '1px',
  } },
  { selector: 'node.label', style: { width: 10, height: 10, shape: 'diamond' } },
  { selector: 'node.root', style: { width: 27, height: 27, 'border-width': 4, 'border-color': '#16a34a' } },
  { selector: 'node.chosen', style: { 'overlay-opacity': 0.2, 'overlay-color': '#0f172a', 'overlay-padding': '7px' } },
  { selector: 'node.inspected', style: { 'border-width': 3, 'border-color': '#0f172a', 'z-index': 20 } },
  { selector: 'node.root.inspected', style: { 'border-width': 5, 'border-color': '#16a34a' } },
  { selector: 'edge', style: {
    width: 1.5, opacity: 0.72, 'line-color': 'data(color)', 'target-arrow-color': 'data(color)',
    'target-arrow-shape': 'triangle', 'curve-style': 'bezier',
  } },
  { selector: 'edge.membership', style: { 'line-style': 'dotted', 'target-arrow-shape': 'none' } },
  { selector: 'edge.inspected', style: { width: 2.5, opacity: 1, 'z-index': 10 } },
  { selector: '.dimmed', style: { opacity: 0.2 } },
  { selector: 'node.issue.dense, node.issue.overlapping-title', style: { label: '' } },
];

const issueId = (id: number) => `issue-${id}`;
const labelId = (id: number) => `label-${id}`;

function graphElements(graph: LinksGraphData): ElementDefinition[] {
  return [
    ...graph.nodes.map(node => ({
      data: { id: issueId(node.id), issue: node, name: node.title, color: issueColors[node.type], shortTitle: node.title },
      classes: node.id === graph.rootId ? 'issue root' : 'issue',
    })),
    ...graph.edges.map(edge => ({
      data: { id: `edge-${edge.id}`, source: issueId(edge.sourceIssueId), target: issueId(edge.targetIssueId),
        color: relationships[edge.linkType].color, relation: edge.linkType },
    })),
    ...graph.labels.map(label => ({
      data: { id: labelId(label.id), name: label.name, color: '#57534e' }, classes: 'label',
    })),
    ...graph.memberships.map(({ issueId: issue, labelId: label }) => ({
      data: { id: `member-${issue}-${label}`, source: issueId(issue), target: labelId(label), color: '#78716c' }, classes: 'membership',
    })),
  ];
}

function hideOverlappingTitles(cy: Core) {
  const issues = cy.nodes('.issue');
  if (issues.length > 120) return;
  issues.removeClass('overlapping-title');

  const footprints = cy.nodes().map(node => ({
    id: node.id(), bounds: node.boundingBox({ includeLabels: false, includeOverlays: false }),
  }));
  const overlaps = (a: BoundingBox12, b: BoundingBox12) =>
    a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  const visibleTitles: BoundingBox12[] = [];
  const hiddenTitles: NodeSingular[] = [];
  // 起点順を優先する。収まらない名前はホバー・フォーカスで読める。
  issues.forEach(node => {
    const title = node.boundingBox({ includeNodes: false, includeOverlays: false });
    if (footprints.some(({ id, bounds }) => id !== node.id() && overlaps(title, bounds))
        || visibleTitles.some(bounds => overlaps(title, bounds))) {
      hiddenTitles.push(node);
    } else {
      visibleTitles.push(title);
    }
  });
  cy.batch(() => hiddenTitles.forEach(node => node.addClass('overlapping-title')));
}

export function nearestTouchNode(cy: Core, point: Position) {
  let closest: NodeSingular | undefined;
  let distance = Infinity;
  // Canvas のタッチ判定は描画順を優先する。余白が重なる縮尺では点の中心を基準にする。
  cy.nodes().forEach(node => {
    const center = node.renderedPosition();
    const candidate = Math.hypot(center.x - point.x, center.y - point.y);
    if (candidate < distance && candidate <= node.renderedOuterWidth() / 2 + 8) {
      closest = node;
      distance = candidate;
    }
  });
  return closest;
}

const emptyInspection = { name: '', neighbors: [] as string[], count: 0 };

export default function LinksGraphCanvas({ graph, selectedId, onSelect }: {
  graph: LinksGraphData;
  selectedId?: number;
  onSelect: (node: IssueNode) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core>(null);
  const handlers = useRef({ onSelect });
  handlers.current = { onSelect };
  const previous = useRef<{ viewportScope: string; elementIds: string[] }>(null);
  const inspectionId = useRef<string | null>(null);
  const keyboardIndex = useRef(0);
  const [inspection, setInspection] = useState(emptyInspection);

  function inspect(node?: NodeSingular) {
    const cy = cyRef.current;
    if (!cy) return;
    const old = cy.elements('.inspected, .dimmed');
    inspectionId.current = node?.id() ?? null;
    if (!node) {
      old.removeClass('inspected dimmed');
      setInspection(emptyInspection);
      return;
    }
    const connected = node.connectedEdges();
    cy.batch(() => {
      old.removeClass('inspected dimmed');
      const neighborhood = node.closedNeighborhood();
      cy.elements().difference(neighborhood).addClass('dimmed');
      node.union(connected).addClass('inspected');
    });
    const neighbors = connected.slice(0, 12).map(edge => {
      const outgoing = edge.source().id() === node.id();
      const other = outgoing ? edge.target() : edge.source();
      const type = edge.data('relation') as LinkType | undefined;
      return type
        ? `${relationships[type][outgoing ? 'outgoing' : 'incoming']} ${other.data('name')}`
        : `${outgoing ? 'Label' : 'Assigned to'} ${other.data('name')}`;
    });
    setInspection({ name: String(node.data('name')), neighbors, count: connected.length });
  }

  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({
      container: container.current,
      style: styles,
      layout: { name: 'preset' },
      minZoom: 0.025,
      maxZoom: 4,
      pixelRatio: 1,
      textureOnViewport: true,
      boxSelectionEnabled: false,
      autoungrabify: true,
      autounselectify: true,
    });
    cyRef.current = cy;
    cy.on('mouseover', 'node', event => inspect(event.target));
    cy.on('mouseout', 'node', () => inspect());
    cy.on('tap', event => {
      const eventType = event.originalEvent?.type;
      const node = eventType === 'touchend' || eventType === 'pointerup'
        ? nearestTouchNode(cy, event.renderedPosition)
        : event.target;
      if (node !== cy && node?.isNode() && node.hasClass('issue')) {
        handlers.current.onSelect(node.data('issue') as IssueNode);
      }
    });
    const resize = new ResizeObserver(() => cy.resize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      cy.destroy();
      cyRef.current = null;
      previous.current = null;
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    const view = container.current;
    if (!cy || !view) return;

    const elements = graphElements(graph);
    const ids = elements.map(element => element.data.id as string);
    const viewportScope = `${graph.rootId}/${graph.depth}`;
    const last = previous.current;
    const changed = !last || ids.length !== last.elementIds.length || ids.some((id, index) => id !== last.elementIds[index]);
    const resetView = last?.viewportScope !== viewportScope;
    const layoutStart = performance.now();
    cy.batch(() => {
      cy.json({ elements });
      cy.nodes('.issue').toggleClass('dense', graph.nodes.length > 120);
    });
    if (changed || resetView) {
      const large = cy.nodes().length > 150 || cy.edges().length > 400;
      if (large) {
        cy.layout({
          name: 'grid', fit: false, cols: Math.ceil(Math.sqrt(cy.nodes().length * 1.35)),
          boundingBox: { x1: 0, y1: 0, w: 440, h: 340 },
          avoidOverlap: true, nodeDimensionsIncludeLabels: false, avoidOverlapPadding: 12,
        }).run();
      } else {
        cy.layout({
          name: 'cose', fit: false, animate: false, randomize: true,
          nodeDimensionsIncludeLabels: true,
          numIter: 250, nodeRepulsion: () => 5500, idealEdgeLength: () => 85, componentSpacing: 65,
        }).run();
      }
    }
    hideOverlappingTitles(cy);
    if (resetView && cy.nodes().length > 0) {
      cy.fit(cy.elements(), 24);
      if (cy.zoom() > 1.3) {
        cy.zoom(1.3);
        cy.center(cy.nodes());
      }
    }
    const inspected = inspectionId.current ? cy.getElementById(inspectionId.current) : null;
    inspect(inspected?.isNode() ? inspected as NodeSingular : undefined);
    previous.current = { viewportScope, elementIds: ids };
    view.dataset.layoutMs = (performance.now() - layoutStart).toFixed(1);
    delete view.dataset.firstRenderMs;
    cy.one('render', () => { view.dataset.firstRenderMs = (performance.now() - layoutStart).toFixed(1); });
    cy.forceRender();
  }, [graph]);

  useEffect(() => {
    const cy = cyRef.current;
    cy?.nodes('.chosen').removeClass('chosen');
    if (selectedId !== undefined) cy?.getElementById(issueId(selectedId)).addClass('chosen');
  }, [selectedId, graph]);

  function inspectKeyboardNode() {
    const node = graph.nodes[keyboardIndex.current] ?? graph.nodes[0];
    const cy = cyRef.current;
    if (!node || !cy) return;
    const element = cy.getElementById(issueId(node.id));
    if (!element.isNode()) return;
    const position = element.renderedPosition();
    if (position.x < 25 || position.y < 25 || position.x > cy.width() - 25 || position.y > cy.height() - 25) {
      cy.center(element);
    }
    inspect(element as NodeSingular);
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const last = graph.nodes.length - 1;
    const index = Math.min(keyboardIndex.current, last);
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        keyboardIndex.current = index > 0 ? index - 1 : last;
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        keyboardIndex.current = index < last ? index + 1 : 0;
        break;
      case 'Home':
        keyboardIndex.current = 0;
        break;
      case 'End':
        keyboardIndex.current = last;
        break;
      case 'Enter':
        if (graph.nodes[index]) onSelect(graph.nodes[index]);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (event.key !== 'Enter') inspectKeyboardNode();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="relative">
        <div ref={container} data-testid="links-graph-canvas" className="h-[min(65dvh,36rem)] min-h-72 touch-none" aria-hidden />
        <div tabIndex={0} role="group" aria-label="Issue link graph" aria-describedby="links-keyboard-help"
          onFocus={inspectKeyboardNode} onBlur={() => inspect()} onKeyDown={handleKey}
          className="pointer-events-none absolute inset-0 rounded-t-lg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-github-green-600" />
        <p id="links-keyboard-help" className="sr-only">Use the arrow keys to move between issues, then Enter to open details.</p>
        <div role="status" aria-live="polite" className={inspection.name
          ? 'pointer-events-none absolute inset-x-3 top-3 z-1 max-h-[45%] overflow-hidden rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-sm shadow-sm sm:right-auto sm:max-w-[65%]'
          : 'sr-only'}>
          <p className="font-medium [overflow-wrap:anywhere]">{inspection.name}</p>
          {inspection.neighbors.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-gray-600 [overflow-wrap:anywhere]">
              {inspection.neighbors.map((name, index) => <li key={index}>{name}</li>)}
              {inspection.count > inspection.neighbors.length && <li>+{inspection.count - inspection.neighbors.length} more</li>}
            </ul>
          )}
        </div>
      </div>
      <div aria-label="Graph legend" className="flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 px-3 py-2 text-xs text-gray-600">
        {Object.entries(issueColors).map(([type, color]) => (
          <span className="inline-flex items-center gap-1.5 capitalize" key={type}>
            <span className="size-2 rounded-full" style={{ backgroundColor: color }} />{type}
          </span>
        ))}
        {Object.entries(relationships).map(([key, relation]) => (
          <span className="inline-flex items-center gap-1.5" key={key}>
            <span style={{ color: relation.color }} aria-hidden>→</span>{relation.legend}
          </span>
        ))}
        {graph.labels.length > 0 && <span>⋯ Label membership</span>}
      </div>
    </div>
  );
}
