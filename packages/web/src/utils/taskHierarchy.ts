/**
 * Task 一覧で、同じ一覧に出ている Task 同士の親子を並びと字下げで表すための計算。
 *
 * 一覧に出る Task・件数は変えない。直接の親が同じ一覧に出ている Task だけを
 * その親の直下へ移し、段数を返す。親が一覧に出ていない Task は元の位置のまま。
 */

interface ParentChildLink {
  sourceIssueId: number;
  targetIssueId: number;
  linkType: string;
}

/**
 * リンク1件から見た `issueId` の親の ID を返す。親子リンクでなければ null。
 * 保存形式: `parent` は source が親、`child` は target が親。
 */
export function parentIdFromLink(issueId: number, link: ParentChildLink): number | null {
  if (link.linkType === 'child' && link.sourceIssueId === issueId) return link.targetIssueId;
  if (link.linkType === 'parent' && link.targetIssueId === issueId) return link.sourceIssueId;
  return null;
}

interface HierarchyRow<T> {
  item: T;
  /** 0 は字下げなし。親の直下は 1、その子は 2。 */
  depth: number;
}

/**
 * @param items 一覧の表示順の Task
 * @param parentIdsByItem Task ID から、その Task の直接の親の ID 一覧（リンクの作成順）
 */
export function arrangeByParent<T extends { id: number }>(
  items: T[],
  parentIdsByItem: ReadonlyMap<number, readonly number[]>,
): HierarchyRow<T>[] {
  const ids = new Set(items.map((item) => item.id));
  const shownParent = new Map<number, number>();
  for (const item of items) {
    const parentId = parentIdsByItem.get(item.id)?.find((id) => id !== item.id && ids.has(id));
    if (parentId !== undefined) shownParent.set(item.id, parentId);
  }

  const children = new Map<number, T[]>();
  for (const item of items) {
    const parentId = shownParent.get(item.id);
    if (parentId === undefined) continue;
    const siblings = children.get(parentId);
    if (siblings) siblings.push(item);
    else children.set(parentId, [item]);
  }

  const rows: HierarchyRow<T>[] = [];
  const placed = new Set<number>();
  const place = (item: T, depth: number) => {
    if (placed.has(item.id)) return;
    placed.add(item.id);
    rows.push({ item, depth });
    for (const child of children.get(item.id) ?? []) place(child, depth + 1);
  };

  for (const item of items) {
    if (!shownParent.has(item.id)) place(item, 0);
  }
  // 親子が循環している Task は上のどの根からも届かない。元の位置順に字下げなしで出す。
  for (const item of items) place(item, 0);

  return rows;
}
