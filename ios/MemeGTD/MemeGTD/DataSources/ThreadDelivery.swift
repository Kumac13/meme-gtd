import GRDB
import Foundation

nonisolated struct ThreadDelivery {
    var historyAvailable = true
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
        return ThreadDelivery(historyAvailable: id < 0 || history != nil || (parent != nil && complete),
                              serverID: serverID ?? (id > 0 ? id : nil), comments: comments)
    }
}
