import cytoscape from 'cytoscape';
import { afterEach, describe, expect, it } from 'vitest';
import { layoutGraph, nearestTouchNode } from '../../src/components/LinksGraphCanvas';

describe('graph layout', () => {
  it('pulls linked issues together and scatters isolated issues around them without rows or overlaps', () => {
    const elements = [
      ...Array.from({ length: 400 }, (_, index) => ({ data: { id: `issue-${index}` }, classes: 'issue' })),
      ...Array.from({ length: 30 }, (_, index) => ({ data: { id: `edge-${index}`, source: `issue-${index}`, target: `issue-${index + (index % 5 === 4 ? 2 : 1)}` } })),
    ];
    const graph = cytoscape({ headless: true, styleEnabled: true, layout: { name: 'preset' }, elements });
    layoutGraph(graph);

    const linked = graph.nodes().filter(node => node.degree(false) > 0);
    const isolated = graph.nodes().difference(linked);
    const points = isolated.map(node => node.position());
    const members = linked.map(node => node.position());
    expect(points.every(point => members.every(member => Math.hypot(point.x - member.x, point.y - member.y) > 20))).toBe(true);

    // 格子配置では同じ y 座標に多数の点が並ぶ。散布では行が生まれない。
    const rows = new Map<number, number>();
    for (const point of points) rows.set(Math.round(point.y), (rows.get(Math.round(point.y)) ?? 0) + 1);
    expect(Math.max(...rows.values())).toBeLessThan(6);

    let closest = Infinity;
    for (let a = 0; a < points.length; a++) {
      for (let b = a + 1; b < points.length; b++) {
        closest = Math.min(closest, Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y));
      }
    }
    expect(closest).toBeGreaterThan(20);
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
