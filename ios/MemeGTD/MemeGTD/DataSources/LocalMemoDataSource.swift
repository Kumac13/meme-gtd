import Foundation
import GRDB

/// Standalone-mode `MemoDataSource` (offline support plan Phase 8), active
/// while Storage Mode is "Standalone".
///
/// Every read and write goes straight to the local GRDB database through
/// `LocalMemoStore` — there is NO outbox and NO server communication, so the
/// app works with no API URL configured and with networking fully cut off.
///
/// Deletes are HARD deletes: in standalone mode nothing ever reaches a
/// server, which is exactly the situation the offline-first path handles by
/// dropping the row outright (queued create + delete cancel out). Soft
/// deleting would only accumulate rows no code path could ever purge.
///
/// Not available in this mode:
/// - promotePreview: server-side logic that is not ported to Swift yet
///   (planned for Phase 11) — throws a user-facing error.
/// - projectId list filters: project membership has no full local mirror, so
///   a filtered request answers an honest empty page.
nonisolated final class LocalMemoDataSource: MemoDataSource {
    private let database: AppDatabase

    init(database: AppDatabase) {
        self.database = database
    }

    // MARK: - List

    func listMemos(queryItems: [URLQueryItem]) async throws -> MemoListResponse {
        let query = LocalMemoStore.ListQuery(queryItems: queryItems)
        if query.hasProjectFilter {
            return query.emptyPage
        }
        return try await database.dbWriter.read { db in
            try LocalMemoStore.listMemos(db, query: query)
        }
    }

    // MARK: - Get

    func getMemo(id: Int) async throws -> Memo {
        try await database.dbWriter.read { db in
            guard let row = try LocalMemoStore.fetchMemoRow(db, id: id) else {
                throw LocalMemoError.memoNotFound
            }
            return try LocalMemoStore.memo(from: row, db: db)
        }
    }

    // MARK: - Create

    func createMemo(_ request: CreateMemoRequest) async throws -> Memo {
        let uuid = UUIDv7.generate()
        let now = ISO8601Millis.now()

        return try await database.dbWriter.write { db in
            try LocalMemoStore.insertMemo(db, uuid: uuid, bodyMd: request.bodyMd, now: now)
            guard let row = try LocalMemoStore.fetchMemoRow(db, uuid: uuid) else {
                throw LocalMemoError.memoNotFound
            }
            return try LocalMemoStore.memo(from: row, db: db)
        }
    }

    // MARK: - Update / bookmark

    func updateMemo(id: Int, _ request: UpdateMemoRequest) async throws -> Memo {
        try await applyUpdate(id: id, bodyMd: request.bodyMd, isBookmarked: request.isBookmarked)
    }

    func bookmarkMemo(id: Int) async throws -> Memo {
        try await applyUpdate(id: id, bodyMd: nil, isBookmarked: true)
    }

    func unbookmarkMemo(id: Int) async throws -> Memo {
        try await applyUpdate(id: id, bodyMd: nil, isBookmarked: false)
    }

    private func applyUpdate(id: Int, bodyMd: String?, isBookmarked: Bool?) async throws -> Memo {
        let now = ISO8601Millis.now()

        return try await database.dbWriter.write { db in
            guard let row = try LocalMemoStore.fetchMemoRow(db, id: id) else {
                throw LocalMemoError.memoNotFound
            }
            let uuid: String = row["uuid"]

            try LocalMemoStore.updateMemoFields(
                db,
                uuid: uuid,
                bodyMd: bodyMd,
                isBookmarked: isBookmarked,
                now: now
            )

            guard let updated = try LocalMemoStore.fetchMemoRow(db, uuid: uuid) else {
                throw LocalMemoError.memoNotFound
            }
            return try LocalMemoStore.memo(from: updated, db: db)
        }
    }

    // MARK: - Delete

    func deleteMemo(id: Int) async throws {
        try await database.dbWriter.write { db in
            guard let row = try LocalMemoStore.fetchMemoRow(db, id: id) else {
                throw LocalMemoError.memoNotFound
            }
            let uuid: String = row["uuid"]
            try LocalMemoStore.hardDeleteMemoWithComments(db, uuid: uuid)
        }
    }

    // MARK: - Promote (unavailable in this mode)

    func promotePreview(memoId: Int) async throws -> PromotePreviewResponse {
        throw StandaloneUnavailableError("Promote is not available in Standalone mode.")
    }

    // MARK: - Comments

    func listComments(memoId: Int) async throws -> [Comment] {
        try await database.dbWriter.read { db in
            guard let memoRow = try LocalMemoStore.fetchMemoRow(db, id: memoId) else {
                throw LocalMemoError.memoNotFound
            }
            let memoUuid: String = memoRow["uuid"]
            return try LocalMemoStore.listComments(db, memoUuid: memoUuid, memoId: memoId)
        }
    }

    func createComment(memoId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        let uuid = UUIDv7.generate()
        let now = ISO8601Millis.now()

        return try await database.dbWriter.write { db in
            guard let memoRow = try LocalMemoStore.fetchMemoRow(db, id: memoId) else {
                throw LocalMemoError.memoNotFound
            }
            let memoUuid: String = memoRow["uuid"]

            try LocalMemoStore.insertComment(
                db,
                uuid: uuid,
                memoUuid: memoUuid,
                bodyMd: request.bodyMd,
                now: now
            )

            guard let row = try LocalMemoStore.fetchCommentRow(db, uuid: uuid) else {
                throw LocalMemoError.commentNotFound
            }
            return LocalMemoStore.comment(from: row, memoId: memoId)
        }
    }

    func updateComment(memoId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        let now = ISO8601Millis.now()

        return try await database.dbWriter.write { db in
            guard let memoRow = try LocalMemoStore.fetchMemoRow(db, id: memoId) else {
                throw LocalMemoError.memoNotFound
            }
            let memoUuid: String = memoRow["uuid"]
            guard let row = try LocalMemoStore.fetchCommentRow(db, memoUuid: memoUuid, id: commentId) else {
                throw LocalMemoError.commentNotFound
            }
            let uuid: String = row["uuid"]

            try LocalMemoStore.updateCommentBody(db, uuid: uuid, bodyMd: request.bodyMd, now: now)

            guard let updated = try LocalMemoStore.fetchCommentRow(db, uuid: uuid) else {
                throw LocalMemoError.commentNotFound
            }
            return LocalMemoStore.comment(from: updated, memoId: memoId)
        }
    }

    func deleteComment(memoId: Int, commentId: Int) async throws {
        try await database.dbWriter.write { db in
            guard let memoRow = try LocalMemoStore.fetchMemoRow(db, id: memoId) else {
                throw LocalMemoError.memoNotFound
            }
            let memoUuid: String = memoRow["uuid"]
            guard let row = try LocalMemoStore.fetchCommentRow(db, memoUuid: memoUuid, id: commentId) else {
                throw LocalMemoError.commentNotFound
            }
            let uuid: String = row["uuid"]
            try LocalMemoStore.hardDeleteComment(db, uuid: uuid)
        }
    }
}
