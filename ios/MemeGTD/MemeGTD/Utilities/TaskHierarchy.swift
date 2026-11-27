import Foundation

/// Task 一覧で、同じ一覧に出ている Task 同士の親子を並びと字下げで表すための計算。
/// `packages/web/src/utils/taskHierarchy.ts` と同じ規則を持つ。
///
/// 一覧に出る Task・件数は変えない。直接の親が同じ一覧に出ている Task だけを
/// その親の直下へ移し、段数を返す。親が一覧に出ていない Task は元の位置のまま。
nonisolated enum TaskHierarchy {
    nonisolated struct Row<Item> {
        let item: Item
        /// 0 は字下げなし。親の直下は 1、その子は 2。
        let depth: Int
    }

    /// リンク1件から見た `issueId` の親の ID を返す。親子リンクでなければ nil。
    /// 保存形式: `parent` は source が親、`child` は target が親。
    /// `linkType` は API と同じ文字列（`LinkType` の rawValue）。
    static func parentId(of issueId: Int, sourceIssueId: Int, targetIssueId: Int, linkType: String) -> Int? {
        if linkType == "child", sourceIssueId == issueId { return targetIssueId }
        if linkType == "parent", targetIssueId == issueId { return sourceIssueId }
        return nil
    }

    /// - Parameters:
    ///   - items: 一覧の表示順の Task
    ///   - id: Task の ID を取り出す関数
    ///   - parentIds: Task ID から、その Task の直接の親の ID 一覧
    static func arrange<Item>(
        _ items: [Item],
        id: (Item) -> Int,
        parentIds: [Int: [Int]]
    ) -> [Row<Item>] {
        let ids = Set(items.map(id))
        var shownParent: [Int: Int] = [:]
        for item in items {
            let itemId = id(item)
            if let parent = parentIds[itemId]?.first(where: { $0 != itemId && ids.contains($0) }) {
                shownParent[itemId] = parent
            }
        }

        var children: [Int: [Item]] = [:]
        for item in items {
            if let parent = shownParent[id(item)] {
                children[parent, default: []].append(item)
            }
        }

        var rows: [Row<Item>] = []
        var placed = Set<Int>()
        func place(_ item: Item, depth: Int) {
            let itemId = id(item)
            guard !placed.contains(itemId) else { return }
            placed.insert(itemId)
            rows.append(Row(item: item, depth: depth))
            for child in children[itemId] ?? [] {
                place(child, depth: depth + 1)
            }
        }

        for item in items where shownParent[id(item)] == nil {
            place(item, depth: 0)
        }
        // 親子が循環している Task は上のどの根からも届かない。元の位置順に字下げなしで出す。
        for item in items {
            place(item, depth: 0)
        }
        return rows
    }
}

extension TaskHierarchy.Row: Identifiable where Item: Identifiable {
    nonisolated var id: Item.ID { item.id }
}
