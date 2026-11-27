import cytoscape from 'cytoscape';
import { afterEach, describe, expect, it } from 'vitest';
import { nearestTouchNode } from '../../src/components/LinksGraphCanvas';

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
