import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import cytoscape, { type Core, type ElementDefinition, type NodeSingular, type Position, type StylesheetStyle } from 'cytoscape';
import {
  forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY,
  type SimulationLinkDatum, type SimulationNodeDatum,
} from 'd3-force';
import type { LinksGraphData } from '../hooks/useLinksGraph';
import { getLinkIcon, getLinkLabel } from '../utils/linkIcons';
import { LabelBadge } from './LabelBadge';

type IssueNode = LinksGraphData['nodes'][number];
type Box = { x1: number; x2: number; y1: number; y2: number };
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

/** 拡大率を√2刻みの段階に丸める。スタイルの更新を段階が変わったときだけにして、ズーム操作を重くしない。 */
export function zoomStep(zoom: number) {
  return Math.pow(2, Math.round(Math.log2(zoom) * 2) / 2);
}

/**
 * 名前の文字は画面上でほぼ一定の大きさに保つ（拡大率で割る）。
 * 拡大するとノードの間隔だけが広がり、重なって隠れていた名前が出てくる。
 * ノードの丸と線も、拡大に比例して巨大にならないよう伸びを抑える。
 */
export function graphStyles(step: number): StylesheetStyle[] {
  // 0.5 倍より引いた表示では文字を一定に保たず、縮尺に合わせて小さくする（その先は非表示）。
  const text = 1 / Math.max(step, 0.5);
  const shape = step > 1 ? Math.pow(step, -0.6) : 1;
  return [
    { selector: 'node', style: { width: 20 * shape, height: 20 * shape, 'background-color': 'data(color)' } },
    { selector: 'node.issue', style: {
      // リンクの多い Issue ほど大きく描く。
      width: `mapData(degree, 0, 12, ${16 * shape}, ${40 * shape})`, height: `mapData(degree, 0, 12, ${16 * shape}, ${40 * shape})`,
      label: 'data(shortTitle)', 'text-valign': 'bottom', 'text-margin-y': 4 * text, 'font-size': 12 * text,
      'text-max-width': `${150 * text}px`, 'text-wrap': 'ellipsis', color: '#1f2937',
      'text-background-color': '#ffffff', 'text-background-opacity': 0.9, 'text-background-padding': `${text}px`,
    } },
    { selector: 'node.label', style: {
      width: 12 * shape, height: 12 * shape, shape: 'diamond', label: 'data(name)', 'font-size': 11 * text, color: '#57534e',
      'text-valign': 'bottom', 'text-margin-y': 3 * text,
    } },
    // 引いた表示では名前を薄くし、さらに引くと消す。起点と注目中のつながりは縮尺によらず読める。
    { selector: 'node.text-faint', style: { 'text-opacity': 0.45 } },
    { selector: 'node.text-hidden', style: { 'text-opacity': 0 } },
    { selector: 'node.root, node.named', style: { 'text-opacity': 1 } },
    { selector: 'node.root', style: { 'border-width': 4 * shape, 'border-color': '#16a34a' } },
    { selector: 'node.chosen', style: { 'overlay-opacity': 0.2, 'overlay-color': '#0f172a', 'overlay-padding': `${7 * shape}px` } },
    { selector: 'node.inspected', style: { 'border-width': 3 * shape, 'border-color': '#0f172a', 'z-index': 20 } },
    { selector: 'node.root.inspected', style: { 'border-width': 5 * shape, 'border-color': '#16a34a' } },
    { selector: 'edge', style: {
      width: 1.5 * shape, opacity: 0.72, 'line-color': 'data(color)', 'target-arrow-color': 'data(color)',
      'target-arrow-shape': 'triangle', 'curve-style': 'bezier',
    } },
    { selector: 'edge[relation = "relates"]', style: { 'target-arrow-shape': 'none' } },
    { selector: 'edge.membership', style: { 'line-style': 'dotted', 'target-arrow-shape': 'none' } },
    { selector: 'edge.inspected', style: { width: 2.5 * shape, opacity: 1, 'z-index': 10 } },
    { selector: '.dimmed', style: { opacity: 0.2 } },
    { selector: 'node.overlapping-title', style: { label: '' } },
  ];
}

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

type SimulatedNode = SimulationNodeDatum & { id: string; element: NodeSingular; radius: number; degree: number };

/**
 * Obsidian の Graph view と同じく、全ノードを1つの力学シミュレーションに乗せる。
 * 中心へ引く力・ノード同士の斥力・リンクの引力を d3-force で計算し、位置を Cytoscape へ反映する。
 * placed に含まれるノードは現在の位置から続け、それ以外は中心付近から広がる。
 */
export function createGraphSimulation(cy: Core, placed?: ReadonlySet<string>) {
  const nodes = cy.nodes().map((element): SimulatedNode => ({
    id: element.id(), element, degree: element.degree(false),
    // 衝突半径は表示中の拡大率に左右されないよう、等倍のときの丸の大きさから決める。
    radius: element.hasClass('issue') ? 8 + Math.min(element.degree(false), 12) : 6,
    ...(placed?.has(element.id()) ? element.position() : {}),
  }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const links = cy.edges().map((edge): SimulationLinkDatum<SimulatedNode> => ({
    source: byId.get(edge.source().id())!, target: byId.get(edge.target().id())!,
  }));
  const simulation = forceSimulation(nodes)
    // リンクが集中するノードほど周りを広く空け、密集しても読み取れるようにする。
    .force('repel', forceManyBody<SimulatedNode>().strength(node => -60 - 25 * Math.sqrt(node.degree)).distanceMax(700))
    .force('link', forceLink(links).distance(link => 45 + 12 * Math.sqrt(Math.max(
      (link.source as SimulatedNode).degree, (link.target as SimulatedNode).degree))))
    .force('centerX', forceX<SimulatedNode>(0).strength(0.05))
    .force('centerY', forceY<SimulatedNode>(0).strength(0.05))
    .force('collide', forceCollide<SimulatedNode>(node => node.radius + 6))
    // 揺り戻しを抑えるため減衰を強め、約120回の計算で静止させる。
    .velocityDecay(0.6)
    .alphaDecay(1 - Math.pow(0.001, 1 / 120))
    .stop();

  let held: string | null = null;
  const frozen: SimulatedNode[] = [];
  return {
    simulation,
    /** シミュレーションの位置を描画へ反映する。つかんでいるノードは利用者の操作を優先する。 */
    apply() {
      // タッチでノードに触れたまま2本目の指を置くと、Cytoscape は free を出さずにノードを離す。
      // つかんだ扱いが残ると他のノードが留まったままになるため、離れていたらここで解除する。
      const grabbed = held === null ? undefined : byId.get(held);
      if (grabbed && !grabbed.element.grabbed()) this.release();
      cy.batch(() => {
        for (const node of nodes) {
          if (!node.element.grabbed()) node.element.position({ x: node.x ?? 0, y: node.y ?? 0 });
        }
      });
    },
    /**
     * つかんだノードをその位置に固定し、リンクでつながる範囲だけを追従させる。
     * つながっていないノードはその場に留め、ドラッグのたびにグラフ全体が揺れないようにする。
     */
    hold(id: string, position: Position) {
      const node = byId.get(id);
      if (!node) return;
      if (held !== id) {
        this.rest();
        held = id;
        const moving = new Set(node.element.component().nodes().map(element => element.id()));
        for (const other of nodes) {
          if (moving.has(other.id)) continue;
          other.fx = other.x;
          other.fy = other.y;
          frozen.push(other);
        }
        simulation.velocityDecay(0.8).alphaTarget(0.1);
      }
      node.fx = position.x;
      node.fy = position.y;
    },
    /** つかんだノードを離す。留めていたノードは、追従した範囲が静止してから rest で解放する。 */
    release() {
      const node = held === null ? undefined : byId.get(held);
      if (!node) return;
      held = null;
      node.fx = null;
      node.fy = null;
      simulation.alphaTarget(0);
    },
    /** 静止後に呼ぶ。その場に留めていたノードを解放する（力が働いていないので動かない）。 */
    rest() {
      for (const node of frozen.splice(0)) {
        node.fx = null;
        node.fy = null;
      }
      simulation.velocityDecay(0.6);
    },
  };
}

/** ノードの位置だけから全体が収まる表示を求める。配置が動いている間も毎フレーム呼べる軽さにする。 */
function fitGraph(cy: Core) {
  if (cy.nodes().empty() || cy.width() === 0 || cy.height() === 0) return;
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  cy.nodes().forEach(node => {
    const { x, y } = node.position();
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  });
  const margin = 70;
  const zoom = Math.min(1.3, cy.width() / (right - left + margin * 2), cy.height() / (bottom - top + margin * 2));
  cy.viewport({ zoom, pan: { x: cy.width() / 2 - zoom * (left + right) / 2, y: cy.height() / 2 - zoom * (top + bottom) / 2 } });
}

function textFade(zoom: number) {
  return zoom < 0.3 ? 'text-hidden' : zoom < 0.5 ? 'text-faint' : '';
}

let measure: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();

/** 文字サイズ 1 のときの名前の幅。Canvas が使えない環境では文字数から見積もる。 */
function titleWidth(name: string) {
  let width = widths.get(name);
  if (width === undefined) {
    if (measure === undefined) {
      measure = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
      if (measure) measure.font = '100px "Helvetica Neue", Helvetica, sans-serif';
    }
    width = measure
      ? measure.measureText(name).width / 100
      : [...name].reduce((sum, char) => sum + (char.charCodeAt(0) > 0xff ? 1 : 0.6), 0);
    widths.set(name, width);
  }
  return width;
}

/**
 * 現在の拡大率で重なる名前を隠す。起点、次にリンクの多いノードの名前を優先して残す。
 * 名前は画面上で一定の大きさなので、拡大するほど残る名前が増える。
 */
export function hideOverlappingTitles(cy: Core) {
  const titled = cy.nodes('.issue, .label').sort((first, second) =>
    Number(second.hasClass('root')) - Number(first.hasClass('root')) || second.degree(false) - first.degree(false));
  titled.removeClass('overlapping-title');
  // 名前を表示しない縮尺では計算しない。
  if (textFade(cy.zoom()) === 'text-hidden') return;

  // 近くの矩形だけを比べるため、名前の最大幅ほどの升目に分けて登録する。
  const cell = 160 / Math.max(zoomStep(cy.zoom()), 0.5);
  const grid = new Map<string, Box[]>();
  const cells = (box: Box) => {
    const keys: string[] = [];
    for (let x = Math.floor(box.x1 / cell); x <= Math.floor(box.x2 / cell); x++) {
      for (let y = Math.floor(box.y1 / cell); y <= Math.floor(box.y2 / cell); y++) keys.push(`${x}/${y}`);
    }
    return keys;
  };
  const collides = (box: Box, own?: Box) => cells(box).some(key => grid.get(key)?.some(other =>
    other !== own && box.x1 < other.x2 && box.x2 > other.x1 && box.y1 < other.y2 && box.y2 > other.y1));
  const add = (box: Box) => {
    for (const key of cells(box)) grid.set(key, [...(grid.get(key) ?? []), box]);
  };

  const shapes = new Map<string, Box>();
  cy.nodes().forEach(node => {
    const { x, y } = node.position();
    const half = node.width() / 2;
    const box = { x1: x - half, x2: x + half, y1: y - half, y2: y + half };
    shapes.set(node.id(), box);
    add(box);
  });
  // 名前の矩形は自前で求める。Cytoscape の名前の寸法は描画後にしか更新されず、
  // 隠していた名前を戻した直後は幅 0 のままになるため使わない。
  const text = 1 / Math.max(zoomStep(cy.zoom()), 0.5);
  const hidden: NodeSingular[] = [];
  titled.forEach(node => {
    const issue = node.hasClass('issue');
    const font = (issue ? 12 : 11) * text;
    const name = String(node.data(issue ? 'shortTitle' : 'name') ?? '');
    const width = Math.min(issue ? 150 * text : Infinity, titleWidth(name) * font) + 2 * text;
    const { x, y } = node.position();
    const top = y + node.height() / 2 + (issue ? 4 : 3) * text;
    const title = { x1: x - width / 2, x2: x + width / 2, y1: top, y2: top + font * 1.25 };
    if (!name || collides(title, shapes.get(node.id()))) hidden.push(node);
    else add(title);
  });
  cy.batch(() => hidden.forEach(node => node.addClass('overlapping-title')));
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
  const physics = useRef<ReturnType<typeof createGraphSimulation>>(null);
  const placed = useRef<Set<string>>(new Set());
  const frame = useRef(0);
  const settling = useRef(false);
  const fade = useRef<string | null>(null);
  const zoomLevel = useRef(1);
  const titleTimer = useRef(0);
  const suppressTap = useRef(false);

  /** 拡大率に合わせて、文字と丸の大きさ・名前の濃さを付け直す。段階が変わったときだけ更新する。 */
  function restyle(force = false) {
    const cy = cyRef.current;
    if (!cy) return;
    const nextStep = zoomStep(cy.zoom());
    if (nextStep !== zoomLevel.current) {
      zoomLevel.current = nextStep;
      cy.style().fromJson(graphStyles(nextStep)).update();
    }
    const next = textFade(cy.zoom());
    if (force || next !== fade.current) {
      fade.current = next;
      cy.batch(() => {
        cy.nodes().removeClass('text-faint text-hidden');
        if (next) cy.nodes().addClass(next);
      });
    }
    // 拡大縮小が止まってから、その縮尺で重なる名前を選び直す。
    window.clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(() => {
      if (cyRef.current === cy) hideOverlappingTitles(cy);
    }, 120);
  }

  /** 力学シミュレーションを落ち着くまで進める。1フレームの計算時間を抑え、描画を止めない。 */
  function animate() {
    cancelAnimationFrame(frame.current);
    const step = () => {
      const cy = cyRef.current;
      const current = physics.current;
      if (!cy || !current) return;
      const { simulation } = current;
      const started = performance.now();
      do simulation.tick();
      while (simulation.alpha() > simulation.alphaMin() && performance.now() - started < 10);
      current.apply();
      if (settling.current && !viewMoved.current) fitGraph(cy);
      if (simulation.alpha() > simulation.alphaMin()) {
        frame.current = requestAnimationFrame(step);
      } else {
        settling.current = false;
        current.rest();
        hideOverlappingTitles(cy);
      }
    };
    frame.current = requestAnimationFrame(step);
  }
  const keyboardIndex = useRef(0);
  const [inspection, setInspection] = useState(emptyInspection);

  function inspect(node?: NodeSingular) {
    const cy = cyRef.current;
    if (!cy) return;
    const old = cy.elements('.inspected, .dimmed, .named');
    inspectionId.current = node?.id() ?? null;
    if (!node) {
      old.removeClass('inspected dimmed named');
      setInspection(emptyInspection);
      return;
    }
    const connected = node.connectedEdges();
    cy.batch(() => {
      old.removeClass('inspected dimmed named');
      const neighborhood = node.closedNeighborhood();
      cy.elements().difference(neighborhood).addClass('dimmed');
      neighborhood.nodes().addClass('named');
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
      style: graphStyles(1),
      layout: { name: 'preset' },
      minZoom: 0.025,
      maxZoom: 4,
      boxSelectionEnabled: false,
      autounselectify: true,
    });
    cyRef.current = cy;
    cy.on('scrollzoom dragpan pinchzoom', () => { viewMoved.current = true; });
    cy.on('zoom', () => restyle());
    // 指を離した時点で、つかんだ扱いが残っていれば解除する（free が届かない経路の保険）。
    cy.on('tapend', () => {
      const current = physics.current;
      if (!current) return;
      current.release();
      if (current.simulation.alpha() <= current.simulation.alphaMin()) current.rest();
    });
    // タッチにはホバーがないため、長押しでつながりの強調と一覧を出す。背景のタップで消す。
    cy.on('taphold', event => {
      if (!event.originalEvent?.type.startsWith('touch')) return;
      const node = event.target !== cy && event.target.isNode()
        ? event.target as NodeSingular : nearestTouchNode(cy, event.renderedPosition);
      if (!node) return;
      suppressTap.current = true;
      inspect(node);
    });
    // クリックでは配置を動かさない。実際にドラッグしたときだけ、つながるノードを追従させる。
    cy.on('drag', 'node', event => {
      const current = physics.current;
      if (!current) return;
      const idle = current.simulation.alpha() <= current.simulation.alphaMin();
      current.hold(event.target.id(), event.target.position());
      if (idle) animate();
    });
    cy.on('free', 'node', () => physics.current?.release());
    cy.on('mouseover', 'node', event => inspect(event.target));
    cy.on('mouseout', 'node', () => inspect());
    cy.on('tap', event => {
      // 長押しの指を離したときのタップでは詳細を開かない。
      if (suppressTap.current) {
        suppressTap.current = false;
        return;
      }
      const eventType = event.originalEvent?.type;
      const node = eventType === 'touchend' || eventType === 'pointerup'
        ? nearestTouchNode(cy, event.renderedPosition)
        : event.target;
      if (node !== cy && node?.isNode() && node.hasClass('issue')) {
        handlers.current.onSelect(node.data('issue') as IssueNode);
      } else if (eventType?.startsWith('touch') || eventType === 'pointerup') {
        inspect();
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
      window.clearTimeout(titleTimer.current);
      cancelAnimationFrame(frame.current);
      physics.current = null;
      placed.current = new Set();
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
    if (resetView) viewMoved.current = false;
    if (changed || resetView) {
      const next = createGraphSimulation(cy, resetView ? undefined : placed.current);
      physics.current = next;
      placed.current = new Set(cy.nodes().map(node => node.id()));
      // 表示する前に静止するまで計算し、点が揺れながら位置を探す様子を見せない。
      // 上限時間を超える大きさのグラフだけ、残りを画面上で進める。
      const deadline = performance.now() + 1500;
      while (next.simulation.alpha() > next.simulation.alphaMin() && performance.now() < deadline) next.simulation.tick();
      next.apply();
      settling.current = next.simulation.alpha() > next.simulation.alphaMin();
      if (settling.current) animate();
    }
    if (!viewMoved.current) fitGraph(cy);
    // 要素を入れ替えるとクラスが初期化されるため、現在の縮尺に合わせて大きさと名前の濃さを付け直す。
    restyle(true);
    hideOverlappingTitles(cy);
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
    const cy = cyRef.current;
    if (cy && ['+', '=', '-'].includes(event.key)) {
      event.preventDefault();
      viewMoved.current = true;
      cy.zoom({
        level: cy.zoom() * (event.key === '-' ? 1 / 1.2 : 1.2),
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      });
      return;
    }
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
        <p id="links-keyboard-help" className="sr-only">Use the arrow keys to move between issues, then Enter to open details. Use plus and minus to zoom.</p>
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
