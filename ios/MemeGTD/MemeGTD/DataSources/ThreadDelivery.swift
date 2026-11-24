import GRDB
import Foundation

nonisolated struct ThreadDelivery {
    var historyAvailable = true
    var parentPending = false
    var pendingComments: Set<Int> = []
    var hasPending: Bool { parentPending || !pendingComments.isEmpty }
    var serverID: Int?
    var comments: [Comment] = []

    // Include metadata changes on their owning issue. Reviewed operations are
    // retained in Settings and are no longer awaiting automatic delivery.
    private static let pendingChanges = """
        WITH pending(owner, comment) AS (
          SELECT coalesce(issue_uuid, json_extract(payload, '$.issueUuid'), target_uuid),
                 CASE WHEN entity = 'comment' THEN target_uuid END
          FROM pending_operations WHERE state != 'review'
          UNION ALL
          SELECT issue_uuid, NULL FROM pending_memberships WHERE needs_review = 0
        )
        """

    static func pendingThreadIDs(_ db: Database, kind: String, endpoint: String) throws -> Set<Int> {
        let ids = try Int.fetchAll(db, sql: pendingChanges + """
             SELECT coalesce(i.server_id, -i.rowid)
             FROM pending JOIN issues i ON i.uuid = owner
             WHERE i.type = ? AND i.is_deleted = 0
             UNION
             SELECT CAST(substr(owner, 11) AS INTEGER) FROM pending
             WHERE owner LIKE 'server-id:%' AND EXISTS (
               SELECT 1 FROM sync_meta WHERE key = ? || substr(owner, 11)
             )
            """, arguments: [kind, "thread.\(endpoint).\(kind)."])
        return Set(ids)
    }

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
        let pending = try Row.fetchAll(db, sql: pendingChanges + """
             SELECT p.comment, c.rowid AS local_id, c.server_id
             FROM pending p LEFT JOIN comments c ON c.uuid = p.comment
             WHERE p.owner IN (?, ?)
            """, arguments: [uuid, "server-id:\(serverID ?? id)"])
        var parentPending = false
        var pendingComments = Set<Int>()
        for row in pending {
            if row["comment"] as String? == nil { parentPending = true }
            if let local: Int = row["local_id"] { pendingComments.insert(-local) }
            if let remote: Int = row["server_id"] { pendingComments.insert(remote) }
        }
        return ThreadDelivery(historyAvailable: id < 0 || history != nil || (parent != nil && complete),
                              parentPending: parentPending, pendingComments: pendingComments,
                              serverID: serverID ?? (id > 0 ? id : nil), comments: comments)
    }
}
