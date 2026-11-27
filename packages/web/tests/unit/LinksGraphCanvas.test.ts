import cytoscape from 'cytoscape';
import { afterEach, describe, expect, it } from 'vitest';
import { createGraphSimulation, nearestTouchNode } from '../../src/components/LinksGraphCanvas';

describe('graph force simulation', () => {
  const elements = [
    ...Array.from({ length: 400 }, (_, index) => ({ data: { id: `issue-${index}` }, classes: 'issue' })),
    ...Array.from({ length: 30 }, (_, index) => ({ data: { id: `edge-${index}`, source: `issue-${index}`, target: `issue-${index + 1}` } })),
  ];

  it('pulls linked issues together and spreads the rest without rows or overlaps', () => {
    const graph = cytoscape({ headless: true, styleEnabled: true, layout: { name: 'preset' }, elements });
    const physics = createGraphSimulation(graph);
    physics.simulation.tick(300);
    physics.apply();

    const points = graph.nodes().map(node => node.position());
    // 格子配置では同じ y 座標に多数の点が並ぶ。力学配置では行が生まれない。
    const rows = new Map<number, number>();
    for (const point of points) rows.set(Math.round(point.y), (rows.get(Math.round(point.y)) ?? 0) + 1);
    expect(Math.max(...rows.values())).toBeLessThan(8);

    let closest = Infinity;
    for (let a = 0; a < points.length; a++) {
      for (let b = a + 1; b < points.length; b++) {
        closest = Math.min(closest, Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y));
      }
    }
    expect(closest).toBeGreaterThan(18);

    const lengths = graph.edges().map(edge => {
      const from = edge.source().position();
      const to = edge.target().position();
      return Math.hypot(from.x - to.x, from.y - to.y);
    });
    const extent = graph.nodes().boundingBox({ includeLabels: false });
    expect(Math.max(...lengths)).toBeLessThan(Math.min(extent.w, extent.h) / 3);
    graph.destroy();
  });

  it('keeps placed nodes where they are and lets linked neighbours follow a held node', () => {
    const graph = cytoscape({ headless: true, styleEnabled: true, layout: { name: 'preset' }, elements });
    const first = createGraphSimulation(graph);
    first.simulation.tick(300);
    first.apply();
    const before = graph.getElementById('issue-200').position();

    const next = createGraphSimulation(graph, new Set(graph.nodes().map(node => node.id())));
    const start = { ...graph.getElementById('issue-200').position() };
    expect(start).toEqual(before);

    const neighbour = graph.getElementById('issue-1');
    const origin = { ...neighbour.position() };
    next.hold('issue-0', { x: origin.x + 900, y: origin.y });
    next.simulation.stop();
    next.simulation.tick(200);
    next.apply();
    expect(graph.getElementById('issue-0').position().x).toBeCloseTo(origin.x + 900);
    expect(neighbour.position().x - origin.x).toBeGreaterThan(400);
    next.release('issue-0');
    next.simulation.stop();
    graph.destroy();
  });
});

describe('touch selection with overlapping graph hit areas', () => {
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    layout: { name: 'preset' },
    elements: [
      { data: { id: 'issue-1' }, classes: 'issue', position: { x: 20, y: 30 } },
      { data: { id: 'issue-2' }, classes: 'issue', position: { x: 44, y: 30 } },
      { data: { id: 'label-1' }, classes: 'label', position: { x: 68, y: 30 } },
    ],
  });

  afterEach(() => cy.destroy());

  it('picks the nearest rendered center, including at small zoom and after panning', () => {
    cy.viewport({ zoom: 0.25, pan: { x: 120, y: 100 } });
    const first = cy.getElementById('issue-1');
    const second = cy.getElementById('issue-2');
    const label = cy.getElementById('label-1');
    const firstPoint = first.renderedPosition();
    const secondPoint = second.renderedPosition();
    expect(secondPoint.x - firstPoint.x).toBeLessThan(8);

    expect(nearestTouchNode(cy, firstPoint)?.id()).toBe(first.id());
    expect(nearestTouchNode(cy, secondPoint)?.id()).toBe(second.id());
    expect(nearestTouchNode(cy, label.renderedPosition())?.id()).toBe(label.id());
    expect(nearestTouchNode(cy, { x: 0, y: 0 })).toBeUndefined();
  });
});
