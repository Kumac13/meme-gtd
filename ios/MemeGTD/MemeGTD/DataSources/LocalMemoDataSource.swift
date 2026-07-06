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
/// promotePreview is computed locally since Phase 11: the memo, its live
/// comments, labels, and links are read from GRDB and shaped by
/// `PromoteEngine` (the Swift port of the server's promote-preview logic).
///
/// Not available in this mode:
/// - projectId list filters and preview projectIds: project membership has
///   no full local mirror (projects stayed server-only in Standalone), so a
///   filtered request answers an honest empty page and the preview reports
///   no project memberships.
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

    // MARK: - Promote preview (local port of GET /api/memos/{id}/promote-preview)

    /// Mirrors `getPromotePreview` in packages/db/src/memoRepository.ts:
    /// - bodyMd: memo body + inlined comments (`PromoteEngine.buildPromoteBody`)
    /// - labels: the memo's label names ordered by name (`listMemoLabels`)
    /// - projectIds: always empty — projects are server-only in Standalone
    ///   mode (no authoritative local membership mirror; the cached
    ///   `project_items` snapshot is deliberately ignored here so the
    ///   preview never preselects projects the standalone UI cannot show
    ///   or assign)
    /// - linkedIssues: both link directions ordered by created_at, deleted
    ///   counterparts excluded. Deviation: rows whose counterpart is missing
    ///   entirely (hard-deleted locally) are dropped instead of surfacing the
    ///   server's `unknown` placeholder, because without the row there is no
    ///   integer id to report — on the server this case cannot occur
    ///   (issues are only ever soft-deleted).
    func promotePreview(memoId: Int) async throws -> PromotePreviewResponse {
        try await database.dbWriter.read { db in
            guard let memoRow = try LocalMemoStore.fetchMemoRow(db, id: memoId) else {
                throw LocalMemoError.memoNotFound
            }
            let memoUuid: String = memoRow["uuid"]
            let bodyMd: String = memoRow["body_md"]

            let comments = try LocalMemoStore.listComments(db, memoUuid: memoUuid, memoId: memoId)

            // listMemoLabels orders by label name (not created_at like the
            // list-screen labels).
            let labels = try String.fetchAll(
                db,
                sql: """
                    SELECT label_name FROM issue_labels
                    WHERE issue_uuid = ?
                    ORDER BY label_name
                    """,
                arguments: [memoUuid]
            )

            // Same shape as the TS link query: both directions, counterpart
            // joined for its display fields, deleted counterparts excluded,
            // created_at order.
            let linkRows = try Row.fetchAll(
                db,
                sql: """
                    SELECT
                      l.source_issue_uuid,
                      l.link_type,
                      i.rowid AS other_rowid,
                      i.server_id AS other_server_id,
                      i.type AS other_type,
                      i.title AS other_title,
                      i.body_md AS other_body
                    FROM links l
                    JOIN issues i ON i.uuid = (
                      CASE WHEN l.source_issue_uuid = ?
                        THEN l.target_issue_uuid
                        ELSE l.source_issue_uuid
                      END
                    )
                    WHERE (l.source_issue_uuid = ? OR l.target_issue_uuid = ?)
                      AND i.is_deleted = 0
                    ORDER BY l.created_at
                    """,
                arguments: [memoUuid, memoUuid, memoUuid]
            )

            let engineRows = linkRows.map { row -> PromoteEngine.LinkRow in
                let otherServerId: Int? = row["other_server_id"]
                let otherRowid: Int64 = row["other_rowid"]
                let otherId = otherServerId ?? -Int(otherRowid)
                let sourceUuid: String = row["source_issue_uuid"]
                let isOutgoing = sourceUuid == memoUuid
                return PromoteEngine.LinkRow(
                    sourceIssueId: isOutgoing ? memoId : otherId,
                    targetIssueId: isOutgoing ? otherId : memoId,
                    linkType: row["link_type"],
                    targetType: row["other_type"],
                    targetTitle: row["other_title"],
                    targetBody: row["other_body"]
                )
            }

            let linkedIssues = PromoteEngine.linkedIssues(memoId: memoId, rows: engineRows)

            return PromotePreviewResponse(
                bodyMd: PromoteEngine.buildPromoteBody(
                    baseBody: bodyMd,
                    comments: comments.map {
                        PromoteEngine.CommentInput(createdAt: $0.createdAt, bodyMd: $0.bodyMd)
                    }
                ),
                labels: labels,
                projectIds: [],
                linkedIssues: linkedIssues.map { linked in
                    PromotePreviewLink(
                        direction: linked.direction,
                        linkType: linked.linkType,
                        targetIssue: PromotePreviewLinkTarget(
                            id: linked.targetId,
                            type: linked.targetType,
                            title: linked.targetTitle
                        )
                    )
                }
            )
        }
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
