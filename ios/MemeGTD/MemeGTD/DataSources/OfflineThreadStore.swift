import Foundation
import GRDB

nonisolated struct OfflineThreadStore {
    let database: AppDatabase
    let onLocalWrite: () -> Void

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
        let key = "thread.\(Settings.shared.effectiveApiUrl).\(kind).\(id)"
        if let saved = try database.syncMetaValue(for: key), let data = Data(base64Encoded: saved) {
            return try JSONDecoder().decode(T.self, from: data)
        }
        let value = try await fetch()
        let encoded = try JSONEncoder().encode(value)
        try database.setSyncMetaValue(encoded.base64EncodedString(), for: key)
        return value
    }

    func comments(id: Int, fetch: () async throws -> [Comment]) async throws -> [Comment] {
        let (key, pending) = try await database.dbWriter.read { db in
            let key = try parent(db, id: id)
            return (key, try LocalCommentStore.listComments(db, issueUuid: key, issueId: id))
        }
        guard key.hasPrefix("server-id:") else { return pending }
        do {
            let history = try await loadBeforeInitialPull(kind: "comments", id: id, fetch: fetch)
            return history + pending
        } catch where !pending.isEmpty {
            return pending
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
        for id in ids {
            try db.execute(sql: "INSERT OR IGNORE INTO pending_memberships(issue_uuid, project_id) VALUES (?, ?)", arguments: [uuid, id])
        }
    }
}
