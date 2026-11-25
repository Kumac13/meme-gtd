import Foundation
import GRDB

nonisolated struct ProjectFilter {
    static let pendingMembershipsSQL = """
        SELECT issue_uuid, project_id FROM pending_memberships WHERE needs_review = 0
        UNION ALL
        SELECT o.target_uuid, j.value
        FROM pending_operations o, json_each(o.payload, '$.projectIds') j
        WHERE o.entity = 'task' AND o.op_type = 'create'
        """

    let ids: [Int]
    let includesUnassigned: Bool

    init(_ raw: String?) {
        let values = (raw ?? "").split(separator: ",")
        ids = values.compactMap { Int($0) }
        includesUnassigned = values.contains("none")
    }

    func append(to conditions: inout [String], arguments: inout [DatabaseValueConvertible]) {
        var matches: [String] = []
        if !ids.isEmpty {
            let parameters = ids.map { _ in "?" }.joined(separator: ",")
            matches.append("""
                i.uuid IN (
                    SELECT issue_uuid FROM (\(Self.pendingMembershipsSQL)) WHERE project_id IN (\(parameters))
                )
                """)
            matches.append("i.server_id IN (SELECT issue_id FROM project_items WHERE project_id IN (\(parameters)))")
            arguments += ids
            arguments += ids
        }
        if includesUnassigned {
            matches.append("""
                ((i.memberships_known = 1 OR i.server_id IS NULL)
                 AND i.uuid NOT IN (SELECT issue_uuid FROM (\(Self.pendingMembershipsSQL)))
                 AND NOT EXISTS (SELECT 1 FROM project_items WHERE issue_id = i.server_id))
                """)
        }
        if !matches.isEmpty { conditions.append("(" + matches.joined(separator: " OR ") + ")") }
    }
}
