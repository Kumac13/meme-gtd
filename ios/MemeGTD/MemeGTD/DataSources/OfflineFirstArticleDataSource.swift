import Foundation
import GRDB

/// Offline-first `ArticleDataSource` (offline support plan Phase 7), active
/// only while the "Offline Sync (Beta)" setting is on.
///
/// The article itself is READ-ONLY offline — its COMMENTS are not: reads
/// (including the comment list) go to the server first and fall back to the
/// local GRDB mirror when the server is unreachable
/// (`APIError.networkError`); writes on the article throw
/// `OfflineReadOnlyError`, while comment writes queue through `CommentOutbox`
/// exactly like memo comments (the sync protocol resolves a comment through
/// its parent's uuid regardless of issue type) and push on the next sync.
///
/// As with tasks, successful remote responses are NOT written back into the
/// local `issues` table — its rows carry sync bookkeeping the REST responses
/// lack, and the pull already delivers article rows (including their `meta`
/// JSON), so the fallback cache stays fresh without a second write path.
///
/// The local read itself (type filter, meta JSON restore, Row → Article) is
/// `LocalArticleStore`, shared with the Standalone-mode
/// `LocalArticleDataSource` since Phase 10.
nonisolated final class OfflineFirstArticleDataSource: ArticleDataSource {
    private let database: AppDatabase
    private let remote: ArticleDataSource
    private let onLocalWrite: () -> Void

    init(
        database: AppDatabase,
        remote: ArticleDataSource,
        onLocalWrite: @escaping () -> Void = {}
    ) {
        self.database = database
        self.remote = remote
        self.onLocalWrite = onLocalWrite
    }

    // MARK: - Reads (remote first, local fallback)

    func listArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse {
        do {
            return try await remote.listArticles(queryItems: queryItems)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            return try await localListArticles(queryItems: queryItems)
        }
    }

    func searchArticles(queryItems: [URLQueryItem]) async throws -> SearchArticlesResponse {
        do {
            return try await remote.searchArticles(queryItems: queryItems)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            let list = try await localListArticles(queryItems: queryItems)
            return SearchArticlesResponse(
                data: list.data.map {
                    SearchArticleItem(
                        id: $0.id,
                        type: $0.type,
                        title: $0.title,
                        updatedAt: $0.updatedAt
                    )
                },
                total: list.total,
                limit: list.limit,
                offset: list.offset
            )
        }
    }

    func getArticle(id: Int) async throws -> Article {
        do {
            return try await remote.getArticle(id: id)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            let local: Article? = try await database.dbWriter.read { db in
                guard let row = try LocalArticleStore.fetchArticleRow(db, id: id) else { return nil }
                return try LocalArticleStore.article(from: row, db: db)
            }
            guard let local else { throw error }
            return local
        }
    }

    // MARK: - Writes (online only)

    func createArticle(_ request: CreateManualArticleRequest) async throws -> Article {
        try await onlineWrite { try await remote.createArticle(request) }
    }

    func updateArticle(id: Int, _ request: UpdateArticleRequest) async throws -> Article {
        try await onlineWrite { try await remote.updateArticle(id: id, request) }
    }

    func bookmarkArticle(id: Int) async throws -> Article {
        try await onlineWrite { try await remote.bookmarkArticle(id: id) }
    }

    func unbookmarkArticle(id: Int) async throws -> Article {
        try await onlineWrite { try await remote.unbookmarkArticle(id: id) }
    }

    // MARK: - Comments (read: server first, local fallback; write: outbox)

    func listComments(articleId: Int) async throws -> [Comment] {
        do {
            let comments = try await remote.listComments(articleId: articleId)
            return try await withPendingComments(comments, articleId: articleId)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            let local: [Comment]? = try await database.dbWriter.read { db in
                guard let row = try LocalArticleStore.fetchArticleRow(db, id: articleId) else { return nil }
                let issueUuid: String = row["uuid"]
                // Same order the server uses: created_at ASC, deleted rows
                // excluded.
                return try LocalCommentStore.listComments(db, issueUuid: issueUuid, issueId: articleId)
            }
            guard let local else { throw error }
            return local
        }
    }

    func createComment(articleId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        do {
            return try await remote.createComment(articleId: articleId, request)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            let now = ISO8601Millis.now()
            let comment = try await database.dbWriter.write { db -> Comment in
                let issueUuid = try Self.mirroredArticleUuid(db, articleId: articleId)
                return try CommentOutbox.create(
                    db,
                    issueUuid: issueUuid,
                    issueId: articleId,
                    bodyMd: request.bodyMd,
                    now: now
                )
            }
            onLocalWrite()
            return comment
        }
    }

    func updateComment(articleId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        // A negative id is a comment written offline that has not been pushed
        // yet: the server has no id for it, so the edit stays in the outbox
        // even when the server is reachable again.
        if commentId < 0 {
            return try await queueCommentUpdate(articleId: articleId, commentId: commentId, bodyMd: request.bodyMd)
        }
        do {
            return try await remote.updateComment(articleId: articleId, commentId: commentId, request)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            return try await queueCommentUpdate(articleId: articleId, commentId: commentId, bodyMd: request.bodyMd)
        }
    }

    func deleteComment(articleId: Int, commentId: Int) async throws {
        if commentId < 0 {
            try await queueCommentDelete(articleId: articleId, commentId: commentId)
            return
        }
        do {
            try await remote.deleteComment(articleId: articleId, commentId: commentId)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            try await queueCommentDelete(articleId: articleId, commentId: commentId)
        }
    }

    private func queueCommentUpdate(articleId: Int, commentId: Int, bodyMd: String) async throws -> Comment {
        let now = ISO8601Millis.now()
        let comment = try await database.dbWriter.write { db -> Comment in
            let issueUuid = try Self.mirroredArticleUuid(db, articleId: articleId)
            return try CommentOutbox.update(
                db,
                issueUuid: issueUuid,
                issueId: articleId,
                commentId: commentId,
                bodyMd: bodyMd,
                now: now
            )
        }
        onLocalWrite()
        return comment
    }

    private func queueCommentDelete(articleId: Int, commentId: Int) async throws {
        let now = ISO8601Millis.now()
        try await database.dbWriter.write { db in
            let issueUuid = try Self.mirroredArticleUuid(db, articleId: articleId)
            try CommentOutbox.delete(db, issueUuid: issueUuid, commentId: commentId, now: now)
        }
        onLocalWrite()
    }

    /// The parent's sync identity, or the read-only error: an article the pull
    /// has not mirrored yet has no uuid to hang a comment on. Throwing from
    /// inside the write block rolls the transaction back untouched.
    private static func mirroredArticleUuid(_ db: Database, articleId: Int) throws -> String {
        guard let row = try LocalArticleStore.fetchArticleRow(db, id: articleId) else {
            throw OfflineReadOnlyError()
        }
        let uuid: String = row["uuid"]
        return uuid
    }

    /// Appends comments written offline that the server cannot know about yet,
    /// so a queued comment stays on the timeline once connectivity returns.
    private func withPendingComments(_ comments: [Comment], articleId: Int) async throws -> [Comment] {
        let pending = try await database.dbWriter.read { db -> [Comment] in
            guard let row = try LocalArticleStore.fetchArticleRow(db, id: articleId) else { return [] }
            let issueUuid: String = row["uuid"]
            return try CommentOutbox.pendingComments(db, issueUuid: issueUuid, issueId: articleId)
        }
        return pending.isEmpty ? comments : comments + pending
    }

    func deleteArticle(id: Int) async throws {
        do {
            try await remote.deleteArticle(id: id)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            throw OfflineReadOnlyError()
        }
    }

    private func onlineWrite<T>(_ operation: () async throws -> T) async throws -> T {
        do {
            return try await operation()
        } catch where OfflineFirstSupport.isNetworkError(error) {
            throw OfflineReadOnlyError()
        }
    }

    // MARK: - Local list query

    private func localListArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse {
        let query = LocalArticleStore.ListQuery(queryItems: queryItems)
        return try await database.dbWriter.read { db in
            try LocalArticleStore.listArticles(db, query: query)
        }
    }
}
