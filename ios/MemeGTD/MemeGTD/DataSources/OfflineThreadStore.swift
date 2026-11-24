import Foundation
import GRDB

nonisolated struct OfflineThreadStore {
    let database: AppDatabase
    let onLocalWrite: () -> Void
    var endpoint = Settings.shared.effectiveApiUrl

    private func parent(_ db: Database, id: Int) throws -> String {
        let column = id > 0 ? "server_id" : "rowid"
        if let uuid = try String.fetchOne(db, sql: "SELECT uuid FROM issues WHERE \(column) = ?", arguments: [abs(id)]) {
            return uuid
        }
        guard id > 0 else { throw LocalMemoError.memoNotFound }
        // 初回pull前にREST経由で開いた親。push時に実UUIDへ解決する。
        return "server-id:\(id)"
    }

    func loadBeforeInitialPull<T: Codable>(kind: String, id: Int, fetch: () async throws -> T) async throws -> T {
        let key = "thread.\(endpoint).\(kind).\(id)"
        if let saved = try database.syncMetaValue(for: key), let data = Data(base64Encoded: saved) {
            return try JSONDecoder().decode(T.self, from: data)
        }
        let value = try await fetch()
        let encoded = try JSONEncoder().encode(value)
        try database.setSyncMetaValue(encoded.base64EncodedString(), for: key)
        return value
    }

    func comments(id: Int, fetch: () async throws -> [Comment]) async throws -> [Comment] {
        let key = try await database.dbWriter.read { db in try parent(db, id: id) }
        if key.hasPrefix("server-id:") {
            _ = try? await loadBeforeInitialPull(kind: "comments", id: id, fetch: fetch)
        }
        return try await database.dbWriter.read { db in
            try ThreadDelivery.read(db, id: id, endpoint: endpoint).comments
        }
    }

    enum PendingIdentity: LocalizedError {
        case awaitingSync
        var errorDescription: String? { "Saved on this device. Try this action after it syncs." }
    }

    func serverIssueID(_ id: Int) async throws -> Int {
        guard id < 0 else { return id }
        return try await database.dbWriter.read { db in
            guard let resolved = try Int.fetchOne(db, sql: "SELECT server_id FROM issues WHERE rowid = ? AND is_deleted = 0", arguments: [-id])
            else { throw PendingIdentity.awaitingSync }
            return resolved
        }
    }

    func serverCommentID(_ id: Int, parentID: Int) async throws -> Int {
        guard id < 0 else { return id }
        return try await database.dbWriter.read { db in
            guard let resolved = try Int.fetchOne(db, sql: """
                SELECT c.server_id FROM comments c JOIN issues i ON i.uuid = c.issue_uuid
                WHERE c.rowid = ? AND i.server_id = ? AND c.is_deleted = 0
                """, arguments: [-id, parentID]) else { throw PendingIdentity.awaitingSync }
            return resolved
        }
    }

    func add(id: Int, body: String) async throws -> Comment {
        let comment = try await database.dbWriter.write { db in
            let key = try parent(db, id: id)
            let uuid = UUIDv7.generate()
            let now = ISO8601Millis.now()
            try LocalCommentStore.insertComment(db, uuid: uuid, issueUuid: key, bodyMd: body, now: now)
            try Self.enqueue(db, entity: .comment, uuid: uuid, parent: key,
                             payload: SyncPushPayload(bodyMd: body, createdAt: now), now: now)
            guard let row = try LocalCommentStore.fetchCommentRow(db, uuid: uuid) else { throw LocalMemoError.commentNotFound }
            return LocalCommentStore.comment(from: row, issueId: id)
        }
        onLocalWrite()
        return comment
    }

    static func enqueue(_ db: Database, entity: SyncPushEntity, uuid: String, parent: String? = nil,
                        payload: SyncPushPayload, now: String) throws {
        var op = PendingOperationRecord(opId: UUID().uuidString.lowercased(), entity: entity.rawValue,
            opType: "create", targetUuid: uuid, issueUuid: parent,
            payload: String(decoding: try JSONEncoder().encode(payload), as: UTF8.self), createdAt: now)
        try op.insert(db)
    }

    static func saveProjects(_ db: Database, ids: [Int], uuid: String) throws {
        try db.execute(sql: "UPDATE issues SET memberships_known = 1 WHERE uuid = ?", arguments: [uuid])
        for id in ids {
            try db.execute(sql: "INSERT OR IGNORE INTO pending_memberships(issue_uuid, project_id) VALUES (?, ?)", arguments: [uuid, id])
        }
    }
}
