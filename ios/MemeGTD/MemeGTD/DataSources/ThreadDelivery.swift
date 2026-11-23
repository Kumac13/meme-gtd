import GRDB
import Foundation

nonisolated struct ThreadDelivery {
    var historyAvailable = true
    var states: [Int: String] = [:]
    var parentState: String?
    var serverID: Int?
    var comments: [Comment] = []

    nonisolated static func read(_ db: Database, id: Int, endpoint: String) throws -> ThreadDelivery {
        let column = id < 0 ? "rowid" : "server_id"
        let parent = try Row.fetchOne(db, sql: "SELECT uuid, server_id FROM issues WHERE \(column) = ?", arguments: [abs(id)])
        let uuid: String = parent?["uuid"] ?? "server-id:\(id)"
        let serverID: Int? = parent?["server_id"]
        let complete = try String.fetchOne(db, sql: "SELECT value FROM sync_meta WHERE key = 'initial_pull_complete'") == "1"
        let cache = try String.fetchOne(db, sql: "SELECT value FROM sync_meta WHERE key = ?", arguments: ["thread.\(endpoint).comments.\(id)"])
        let history = cache.flatMap { Data(base64Encoded: $0) }.flatMap { try? JSONDecoder().decode([Comment].self, from: $0) }
        var comments = try LocalCommentStore.listComments(db, issueUuid: uuid, issueId: id)
        if !complete || parent == nil, let history {
            let ids = Set(comments.map(\.id))
            comments = history.filter { !ids.contains($0.id) } + comments
        }
        var states: [Int: String] = [:]
        let rows = try Row.fetchAll(db, sql: """
            SELECT c.rowid AS local_id, c.server_id, o.state FROM comments c
            LEFT JOIN pending_operations o ON o.target_uuid = c.uuid
            WHERE c.issue_uuid = ? ORDER BY o.id
            """, arguments: [uuid])
        for row in rows {
            let localID: Int = row["local_id"]
            let remoteID: Int? = row["server_id"]
            let state: String? = row["state"]
            let text: String
            switch state {
            case "review": text = "Needs review"
            case nil: text = remoteID == nil ? "Saved on device" : "Synced"
            default: text = "Waiting to sync"
            }
            states[-localID] = text
            if let remoteID { states[remoteID] = text }
        }
        let pendingState = try String.fetchOne(db, sql: "SELECT state FROM pending_operations WHERE target_uuid = ? ORDER BY id LIMIT 1", arguments: [uuid])
        let parentState: String?
        switch pendingState {
        case "review": parentState = "Needs review"
        case nil: parentState = nil
        default: parentState = "Waiting to sync"
        }
        return ThreadDelivery(historyAvailable: id < 0 || history != nil || (parent != nil && complete),
                              states: states, parentState: parentState, serverID: serverID ?? (id > 0 ? id : nil), comments: comments)
    }
}
