import Foundation
import GRDB

nonisolated struct ProjectFilter {
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
            matches.append("i.uuid IN (SELECT issue_uuid FROM pending_memberships WHERE needs_review = 0 AND project_id IN (\(parameters)))")
            matches.append("i.server_id IN (SELECT issue_id FROM project_items WHERE project_id IN (\(parameters)))")
            arguments += ids
            arguments += ids
        }
        if includesUnassigned {
            matches.append("""
                ((i.memberships_known = 1 OR i.server_id IS NULL)
                 AND NOT EXISTS (SELECT 1 FROM pending_memberships WHERE issue_uuid = i.uuid AND needs_review = 0)
                 AND NOT EXISTS (SELECT 1 FROM project_items WHERE issue_id = i.server_id))
                """)
        }
        if !matches.isEmpty { conditions.append("(" + matches.joined(separator: " OR ") + ")") }
    }
}
