import { describe, expect, it } from 'vitest';
import { arrangeByParent, parentIdFromLink } from '../../src/utils/taskHierarchy';

const task = (id: number) => ({ id });
const shape = (rows: Array<{ item: { id: number }; depth: number }>) =>
  rows.map((row) => [row.item.id, row.depth]);

describe('parentIdFromLink', () => {
  it('reads the parent from a child link whose source is the task', () => {
    expect(parentIdFromLink(2, { sourceIssueId: 2, targetIssueId: 1, linkType: 'child' })).toBe(1);
  });

  it('reads the parent from a parent link whose target is the task', () => {
    expect(parentIdFromLink(2, { sourceIssueId: 1, targetIssueId: 2, linkType: 'parent' })).toBe(1);
  });

  it('returns null when the task is the parent side or the link is not parent/child', () => {
    expect(parentIdFromLink(1, { sourceIssueId: 2, targetIssueId: 1, linkType: 'child' })).toBeNull();
    expect(parentIdFromLink(1, { sourceIssueId: 1, targetIssueId: 2, linkType: 'parent' })).toBeNull();
    expect(parentIdFromLink(2, { sourceIssueId: 2, targetIssueId: 1, linkType: 'relates' })).toBeNull();
  });
});

describe('arrangeByParent', () => {
  it('keeps the order and depth 0 when no task has a shown parent', () => {
    const rows = arrangeByParent([task(3), task(2), task(1)], new Map());
    expect(shape(rows)).toEqual([[3, 0], [2, 0], [1, 0]]);
  });

  it('moves a child directly under its parent with one level of indent', () => {
    // 子1(2) は親(1) より上に並んでいても、親の直下に移る
    const rows = arrangeByParent([task(2), task(9), task(1)], new Map([[2, [1]]]));
    expect(shape(rows)).toEqual([[9, 0], [1, 0], [2, 1]]);
  });

  it('leaves a child in place when its parent is not in the list', () => {
    // 子2(3) の親(1) は別の status なので一覧にいない
    const rows = arrangeByParent([task(9), task(3)], new Map([[3, [1]]]));
    expect(shape(rows)).toEqual([[9, 0], [3, 0]]);
  });

  it('indents a grandchild one more level under its own parent', () => {
    const rows = arrangeByParent(
      [task(3), task(2), task(1)],
      new Map([[2, [1]], [3, [2]]]),
    );
    expect(shape(rows)).toEqual([[1, 0], [2, 1], [3, 2]]);
  });

  it('does not attach a grandchild to its grandparent when the middle task is missing', () => {
    const rows = arrangeByParent([task(3), task(1)], new Map([[3, [2]], [2, [1]]]));
    expect(shape(rows)).toEqual([[3, 0], [1, 0]]);
  });

  it('keeps siblings in their list order under the parent', () => {
    const rows = arrangeByParent(
      [task(5), task(1), task(4)],
      new Map([[5, [1]], [4, [1]]]),
    );
    expect(shape(rows)).toEqual([[1, 0], [5, 1], [4, 1]]);
  });

  it('uses the first shown parent when a task has several parents', () => {
    const rows = arrangeByParent(
      [task(3), task(2), task(1)],
      new Map([[3, [7, 2, 1]]]),
    );
    expect(shape(rows)).toEqual([[2, 0], [3, 1], [1, 0]]);
  });

  it('shows every task exactly once even when parent links form a cycle', () => {
    const rows = arrangeByParent([task(1), task(2)], new Map([[1, [2]], [2, [1]]]));
    expect(rows.map((row) => row.item.id).sort()).toEqual([1, 2]);
  });
});
