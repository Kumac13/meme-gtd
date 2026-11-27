import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import cytoscape, { type BoundingBox12, type Core, type ElementDefinition, type NodeCollection, type NodeSingular, type Position, type StylesheetStyle } from 'cytoscape';
import type { LinksGraphData } from '../hooks/useLinksGraph';
import { getLinkIcon, getLinkLabel } from '../utils/linkIcons';
import { LabelBadge } from './LabelBadge';

type IssueNode = LinksGraphData['nodes'][number];
type LinkType = LinksGraphData['edges'][number]['linkType'];

const issueColors = { task: '#2563eb', memo: '#7c3aed', article: '#c2410c' };
// 親子は保存種別（parent / child）によらず、親から子への1種類の矢印で描く。
// relates は向きを持たない関係なので、矢印を付けずに線だけで描く。
const relationships: Record<LinkType, { color: string; legend?: string; mark?: string }> = {
  parent: { color: '#2563eb', legend: 'Parent → Child', mark: '→' },
  child: { color: '#2563eb' },
  derived_from: { color: '#b45309', legend: 'Derived → Source', mark: '→' },
  relates: { color: '#64748b', legend: 'Relates', mark: '—' },
};

const styles: StylesheetStyle[] = [
  { selector: 'node', style: { width: 20, height: 20, 'background-color': 'data(color)' } },
  { selector: 'node.issue', style: {
    // リンクの多い Issue ほど大きく描く。名前は読める縮尺まで拡大したときに出す。
    width: 'mapData(degree, 0, 12, 16, 40)', height: 'mapData(degree, 0, 12, 16, 40)', 'min-zoomed-font-size': 9,
    label: 'data(shortTitle)', 'text-valign': 'bottom', 'text-margin-y': 4, 'font-size': 11,
    'text-max-width': '112px', 'text-wrap': 'ellipsis', color: '#1f2937',
    'text-background-color': '#ffffff', 'text-background-opacity': 0.9, 'text-background-padding': '1px',
  } },
  { selector: 'node.label', style: {
    width: 12, height: 12, shape: 'diamond', label: 'data(name)', 'font-size': 10, color: '#57534e',
    'text-valign': 'bottom', 'text-margin-y': 3, 'min-zoomed-font-size': 9,
  } },
  { selector: 'node.root', style: { 'border-width': 4, 'border-color': '#16a34a' } },
  { selector: 'node.chosen', style: { 'overlay-opacity': 0.2, 'overlay-color': '#0f172a', 'overlay-padding': '7px' } },
  { selector: 'node.inspected', style: { 'border-width': 3, 'border-color': '#0f172a', 'z-index': 20 } },
  { selector: 'node.root.inspected', style: { 'border-width': 5, 'border-color': '#16a34a' } },
  { selector: 'edge', style: {
    width: 1.5, opacity: 0.72, 'line-color': 'data(color)', 'target-arrow-color': 'data(color)',
    'target-arrow-shape': 'triangle', 'curve-style': 'bezier',
  } },
  { selector: 'edge[relation = "relates"]', style: { 'target-arrow-shape': 'none' } },
  { selector: 'edge.membership', style: { 'line-style': 'dotted', 'target-arrow-shape': 'none' } },
  { selector: 'edge.inspected', style: { width: 2.5, opacity: 1, 'z-index': 10 } },
  { selector: '.dimmed', style: { opacity: 0.2 } },
  { selector: 'node.overlapping-title', style: { label: '' } },
];

const issueId = (id: number) => `issue-${id}`;
const labelId = (id: number) => `label-${id}`;

function graphElements(graph: LinksGraphData): ElementDefinition[] {
  const degree = new Map<number, number>();
  for (const { sourceIssueId, targetIssueId } of graph.edges) {
    degree.set(sourceIssueId, (degree.get(sourceIssueId) ?? 0) + 1);
    degree.set(targetIssueId, (degree.get(targetIssueId) ?? 0) + 1);
  }
  return [
    ...graph.nodes.map(node => ({
      data: { id: issueId(node.id), issue: node, name: node.title, color: issueColors[node.type], shortTitle: node.title,
        degree: degree.get(node.id) ?? 0 },
      classes: node.id === graph.rootId ? 'issue root' : 'issue',
    })),
    ...graph.edges.map(edge => {
      const [tail, head] = edge.linkType === 'child'
        ? [edge.targetIssueId, edge.sourceIssueId] : [edge.sourceIssueId, edge.targetIssueId];
      return {
        data: { id: `edge-${edge.id}`, source: issueId(tail), target: issueId(head), saved: issueId(edge.sourceIssueId),
          color: relationships[edge.linkType].color, relation: edge.linkType },
      };
    }),
    ...graph.labels.map(label => ({
      data: { id: labelId(label.id), name: label.name, color: '#57534e' }, classes: 'label',
    })),
    ...graph.memberships.map(({ issueId: issue, labelId: label }) => ({
      data: { id: `member-${issue}-${label}`, source: issueId(issue), target: labelId(label), color: '#78716c' }, classes: 'membership',
    })),
  ];
}

const ISOLATED_SPACING = 46;

/** 力学配置の後も重なったままの点を、互いに離れる向きへ少しずつ押し出す。 */
function separateOverlaps(nodes: NodeCollection) {
  if (nodes.length > 1500) return;
  const points = nodes.map(node => ({ node, ...node.position(), radius: node.width() / 2 + 6, moved: false }));
  for (let pass = 0; pass < 8; pass++) {
    let touching = false;
    for (let first = 0; first < points.length; first++) {
      for (let second = first + 1; second < points.length; second++) {
        const a = points[first];
        const b = points[second];
        const gap = a.radius + b.radius;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        if (Math.abs(dx) >= gap || Math.abs(dy) >= gap) continue;
        let distance = Math.hypot(dx, dy);
        if (distance >= gap) continue;
        if (distance === 0) {
          dx = 1;
          dy = 0;
          distance = 1;
        }
        const push = (gap - distance) / 2 / distance;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
        a.moved = b.moved = touching = true;
      }
    }
    if (!touching) break;
  }
  for (const point of points) if (point.moved) point.node.position({ x: point.x, y: point.y });
}

/**
 * リンクでつながるかたまりは力学配置（Cytoscape 内蔵 cose）で形を決め、
 * かたまりと孤立した点を一つの円盤の中へ不規則に散らす。格子・行・輪には並べない。
 */
export function layoutGraph(cy: Core) {
  const linked = cy.nodes().filter(node => node.degree(false) > 0);
  const isolated = cy.nodes().difference(linked);
  const count = linked.length;
  const connected = linked.union(linked.connectedEdges());
  if (count > 0) {
    const side = Math.max(320, Math.sqrt(count) * 90);
    connected.layout({
      name: 'cose', fit: false, animate: false, randomize: true,
      boundingBox: { x1: 0, y1: 0, w: side, h: side },
      nodeDimensionsIncludeLabels: count <= 120,
      // 斥力計算は点の数の2乗で増えるため、大きいグラフでは反復を減らして初回描画を保つ。
      numIter: Math.max(12, Math.min(1000, Math.floor(2e8 / (count * count)))),
      // リンクやラベル所属が集中する点ほど周りを広く空け、密集しても点同士が重ならないようにする。
      nodeOverlap: 40,
      nodeRepulsion: node => 6000 + 2500 * node.degree(false),
      idealEdgeLength: edge => 70 + 22 * Math.sqrt(Math.max(edge.source().degree(false), edge.target().degree(false))),
      componentSpacing: 65,
    }).run();
    separateOverlaps(linked);
  }

  // 再読み込みで位置が変わらないよう、固定シードの乱数を使う。
  let seed = 0x2f6e2b1;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const inDisc = (radius: number): Position => {
    const distance = radius * Math.sqrt(random());
    const angle = random() * Math.PI * 2;
    return { x: distance * Math.cos(angle), y: distance * Math.sin(angle) };
  };

  const clusters = connected.components().map(component => {
    const box = component.boundingBox({ includeLabels: false, includeOverlays: false });
    return {
      nodes: component.nodes(), from: { x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2 },
      radius: Math.hypot(box.w, box.h) / 2 + ISOLATED_SPACING / 2, x: 0, y: 0,
    };
  }).sort((first, second) => second.radius - first.radius);
  if (clusters.length <= 1 && isolated.empty()) return;

  const clusterArea = clusters.reduce((sum, cluster) => sum + cluster.radius * cluster.radius, 0);
  const extent = Math.sqrt(clusterArea * 1.7 + (isolated.length * ISOLATED_SPACING * ISOLATED_SPACING * 1.8) / Math.PI);
  // 大きいかたまりから中心寄りに置き、他のかたまりと重ならない位置を選ぶ。
  const placed: typeof clusters = [];
  for (const cluster of clusters) {
    let best: Position = { x: 0, y: 0 };
    let bestScore = Infinity;
    for (let attempt = 0; attempt < (placed.length ? 60 : 1); attempt++) {
      const candidate = placed.length ? inDisc(Math.max(0, extent - cluster.radius)) : { x: 0, y: 0 };
      const overlap = placed.reduce((sum, other) =>
        sum + Math.max(0, other.radius + cluster.radius - Math.hypot(other.x - candidate.x, other.y - candidate.y)), 0);
      const score = overlap * 1000 + Math.hypot(candidate.x, candidate.y);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    cluster.x = best.x;
    cluster.y = best.y;
    placed.push(cluster);
  }

  const cells = new Map<string, Position[]>();
  const cell = (value: number) => Math.floor(value / ISOLATED_SPACING);
  const nearest = (point: Position) => {
    let best = Infinity;
    for (let x = cell(point.x) - 1; x <= cell(point.x) + 1; x++) {
      for (let y = cell(point.y) - 1; y <= cell(point.y) + 1; y++) {
        for (const other of cells.get(`${x}/${y}`) ?? []) {
          best = Math.min(best, Math.hypot(other.x - point.x, other.y - point.y));
        }
      }
    }
    return best;
  };
  cy.batch(() => {
    for (const cluster of clusters) {
      cluster.nodes.shift({ x: cluster.x - cluster.from.x, y: cluster.y - cluster.from.y });
    }
    isolated.forEach(node => {
      // かたまりの外で、既存の点から最も離れた候補を選び、重なりと整列の両方を避ける。
      let chosen: Position | undefined;
      let chosenDistance = -1;
      for (let attempt = 0; attempt < 12 && chosenDistance < ISOLATED_SPACING; attempt++) {
        const candidate = inDisc(extent);
        if (clusters.some(cluster => Math.hypot(cluster.x - candidate.x, cluster.y - candidate.y) < cluster.radius)) continue;
        const distance = nearest(candidate);
        if (distance > chosenDistance) {
          chosen = candidate;
          chosenDistance = distance;
        }
      }
      chosen ??= inDisc(extent);
      node.position(chosen);
      const key = `${cell(chosen.x)}/${cell(chosen.y)}`;
      cells.set(key, [...(cells.get(key) ?? []), chosen]);
    });
  });
}

function fitGraph(cy: Core) {
  if (cy.nodes().empty()) return;
  cy.fit(cy.elements(), 24);
  if (cy.zoom() > 1.3) {
    cy.zoom(1.3);
    cy.center(cy.elements());
  }
}

function hideOverlappingTitles(cy: Core) {
  const issues = cy.nodes('.issue, .label');
  issues.removeClass('overlapping-title');
  if (issues.length > 800) return;

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

type Neighbor = { name: string; icon?: ReactElement; relation?: string; label?: boolean };
const emptyInspection = { name: '', neighbors: [] as Neighbor[], count: 0 };

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
  const viewMoved = useRef(false);
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
    const neighbors = connected.slice(0, 12).map((edge): Neighbor => {
      const other = edge.source().id() === node.id() ? edge.target() : edge.source();
      const name = String(other.data('name'));
      const type = edge.data('relation') as LinkType | undefined;
      if (!type) return { name, label: other.hasClass('label') };
      // 既存の Links 欄と同じアイコンで、保存された向きから見た関係を示す。
      const direction = edge.data('saved') === node.id() ? 'outgoing' : 'incoming';
      return { name, icon: getLinkIcon(type, direction), relation: getLinkLabel(type, direction) };
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
      boxSelectionEnabled: false,
      autounselectify: true,
    });
    cyRef.current = cy;
    cy.on('scrollzoom dragpan pinchzoom', () => { viewMoved.current = true; });
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
    const resize = new ResizeObserver(() => {
      cy.resize();
      // 利用者が動かす前の表示は、枠の大きさが決まった時点でも全体が収まるようにする。
      if (!viewMoved.current) fitGraph(cy);
    });
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
    cy.json({ elements });
    if (changed || resetView) layoutGraph(cy);
    hideOverlappingTitles(cy);
    if (resetView || (changed && !viewMoved.current)) {
      viewMoved.current = false;
      fitGraph(cy);
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
              {inspection.neighbors.map((neighbor, index) => (
                <li key={index} className="flex items-start gap-1.5">
                  {neighbor.icon && <span className="shrink-0 text-gray-500" title={neighbor.relation}>{neighbor.icon}</span>}
                  {neighbor.label ? <LabelBadge name={neighbor.name} /> : <span className="min-w-0">{neighbor.name}</span>}
                </li>
              ))}
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
        {Object.entries(relationships).map(([key, relation]) => relation.legend && (
          <span className="inline-flex items-center gap-1.5" key={key}>
            <span style={{ color: relation.color }} aria-hidden>{relation.mark}</span>{relation.legend}
          </span>
        ))}
        {graph.labels.length > 0 && <span>⋯ Label membership</span>}
      </div>
    </div>
  );
}
