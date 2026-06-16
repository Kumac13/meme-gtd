import Foundation

/// CRUD + queries over `local_memos`. Repositories are the only thing that
/// touches SQL; ViewModels see typed Swift records and never raw rows.
final class LocalMemoRepository {
    private let db: SQLiteDatabase
    private let isoFormatter: ISO8601DateFormatter

    init(db: SQLiteDatabase = LocalDatabase.shared.sqlite) {
        self.db = db
        self.isoFormatter = ISO8601DateFormatter()
        self.isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    }

    /// Optimistic create: returns the row immediately, before any sync.
    /// `serverSyncedAt` is nil so the SyncEngine can find it on its next pass.
    @discardableResult
    func createPendingMemo(bodyMd: String) throws -> LocalMemo {
        let now = Date()
        let memo = LocalMemo(
            id: ULID.generate(),
            serverId: nil,
            bodyMd: bodyMd,
            isBookmarked: false,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
            serverSyncedAt: nil
        )
        try db.write("""
            INSERT INTO local_memos (id, server_id, body_md, is_bookmarked, is_deleted, created_at, updated_at, server_synced_at)
            VALUES (?, NULL, ?, 0, 0, ?, ?, NULL);
            """) { stmt in
                try stmt.bind(1, memo.id)
                try stmt.bind(2, memo.bodyMd)
                try stmt.bind(3, self.isoFormatter.string(from: memo.createdAt))
                try stmt.bind(4, self.isoFormatter.string(from: memo.updatedAt))
            }
        return memo
    }

    /// Called by the SyncEngine once the server confirms the memo.
    /// We stash the server-assigned INTEGER id so subsequent UPDATE/DELETE
    /// operations can address the right row.
    func markSynced(localId: String, serverId: Int64, syncedAt: Date) throws {
        try db.write("""
            UPDATE local_memos
            SET server_id = ?, server_synced_at = ?
            WHERE id = ?;
            """) { stmt in
                try stmt.bind(1, serverId)
                try stmt.bind(2, self.isoFormatter.string(from: syncedAt))
                try stmt.bind(3, localId)
            }
    }

    /// Bulk upsert used by the cache-refresh path to absorb the server's
    /// view of memos that already exist remotely. INSERT OR REPLACE is fine
    /// because every column we care about is captured in `memos`.
    func upsertSyncedMemos(_ memos: [SyncedMemoRow]) throws {
        try db.transaction { [db, isoFormatter] in
            for row in memos {
                try db.write("""
                    INSERT INTO local_memos (id, server_id, body_md, is_bookmarked, is_deleted, created_at, updated_at, server_synced_at)
                    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        server_id = excluded.server_id,
                        body_md = excluded.body_md,
                        is_bookmarked = excluded.is_bookmarked,
                        updated_at = excluded.updated_at,
                        server_synced_at = excluded.server_synced_at;
                    """) { stmt in
                        try stmt.bind(1, row.localId)
                        try stmt.bind(2, row.serverId)
                        try stmt.bind(3, row.bodyMd)
                        try stmt.bind(4, row.isBookmarked)
                        try stmt.bind(5, isoFormatter.string(from: row.createdAt))
                        try stmt.bind(6, isoFormatter.string(from: row.updatedAt))
                        try stmt.bind(7, isoFormatter.string(from: row.syncedAt))
                    }
            }
        }
    }

    func deleteByLocalId(_ id: String) throws {
        try db.write("DELETE FROM local_memos WHERE id = ?;") { stmt in
            try stmt.bind(1, id)
        }
    }

    func findByLocalId(_ id: String) throws -> LocalMemo? {
        var result: LocalMemo?
        try db.query("""
            SELECT id, server_id, body_md, is_bookmarked, is_deleted, created_at, updated_at, server_synced_at
            FROM local_memos WHERE id = ?;
            """, bind: { stmt in
                try stmt.bind(1, id)
            }, rowHandler: { row in
                result = try self.decode(row: row)
            })
        return result
    }

    /// Reverse-chronological list, mirroring the server's default sort,
    /// so the on-device cache feels identical to the live one.
    func listMemos(limit: Int = 200) throws -> [LocalMemo] {
        var memos: [LocalMemo] = []
        try db.query("""
            SELECT id, server_id, body_md, is_bookmarked, is_deleted, created_at, updated_at, server_synced_at
            FROM local_memos
            WHERE is_deleted = 0
            ORDER BY created_at DESC
            LIMIT ?;
            """, bind: { stmt in
                try stmt.bind(1, Int64(limit))
            }, rowHandler: { row in
                memos.append(try self.decode(row: row))
            })
        return memos
    }

    func pendingSyncCount() throws -> Int {
        Int(try db.scalarInt("SELECT COUNT(*) FROM local_memos WHERE server_synced_at IS NULL;"))
    }

    private func decode(row: SQLiteStatement) throws -> LocalMemo {
        let id = try row.requiredString(at: 0, name: "id")
        let serverIdRaw = row.int64(at: 1)
        let serverId: Int64? = serverIdRaw == 0 && row.string(at: 1) == nil ? nil : serverIdRaw
        let bodyMd = try row.requiredString(at: 2, name: "body_md")
        let isBookmarked = row.bool(at: 3)
        let isDeleted = row.bool(at: 4)
        let createdAt = try parseDate(row.string(at: 5), name: "created_at")
        let updatedAt = try parseDate(row.string(at: 6), name: "updated_at")
        let syncedAt: Date? = row.string(at: 7).flatMap(isoFormatter.date(from:))

        // SQLite returns 0 for both "NULL" and "0" via int64. To distinguish
        // we re-read the column as text; if nil, it really was NULL.
        let serverIdNormalized: Int64?
        if row.string(at: 1) == nil {
            serverIdNormalized = nil
        } else {
            serverIdNormalized = serverId
        }

        return LocalMemo(
            id: id,
            serverId: serverIdNormalized,
            bodyMd: bodyMd,
            isBookmarked: isBookmarked,
            isDeleted: isDeleted,
            createdAt: createdAt,
            updatedAt: updatedAt,
            serverSyncedAt: syncedAt
        )
    }

    private func parseDate(_ str: String?, name: String) throws -> Date {
        guard let str = str, let date = isoFormatter.date(from: str) else {
            throw SQLiteError.unexpectedNullColumn(name: name)
        }
        return date
    }
}

/// DTO used by the cache-refresh path to drop server-fetched memos into the
/// local store. Kept separate from `LocalMemo` because the cache path always
/// has both a clientId and a server id, whereas the offline-create path may
/// not.
struct SyncedMemoRow {
    let localId: String
    let serverId: Int64
    let bodyMd: String
    let isBookmarked: Bool
    let createdAt: Date
    let updatedAt: Date
    let syncedAt: Date
}
