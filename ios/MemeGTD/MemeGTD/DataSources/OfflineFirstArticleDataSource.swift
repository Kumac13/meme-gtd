import Foundation
import GRDB

/// Offline-first `ArticleDataSource` (offline support plan Phase 7), active
/// only while the "Offline Sync (Beta)" setting is on.
///
/// The article CONTENT is READ-ONLY offline: reads go to the server first and
/// fall back to the local GRDB mirror when the server is unreachable
/// (`APIError.networkError`); article writes throw `OfflineReadOnlyError`
/// when they cannot reach the server. COMMENTS are the exception — same
/// rules as `OfflineFirstTaskDataSource`: reads fall back to the local
/// mirror, writes fall back to the local-write + outbox path
/// (`CommentOutbox`) and sync on recovery.
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

    // MARK: - Comments (remote first, local fallback / outbox fallback)

    func listComments(articleId: Int) async throws -> [Comment] {
        do {
            return try await remote.listComments(articleId: articleId)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            // Comment rows arrive through the same sync change feed as the
            // article rows themselves — read them like the task data source
            // does (created_at ASC, deleted rows excluded).
            let local: [Comment]? = try await database.dbWriter.read { db in
                guard let articleRow = try LocalArticleStore.fetchArticleRow(db, id: articleId) else { return nil }
                let articleUuid: String = articleRow["uuid"]
                return try LocalCommentStore.listComments(db, issueUuid: articleUuid, issueId: articleId)
            }
            guard let local else { throw error }
            return local
        }
    }

    func createComment(articleId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        do {
            return try await remote.createComment(articleId: articleId, request)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            let local: Comment? = try await database.dbWriter.write { db in
                guard let articleRow = try LocalArticleStore.fetchArticleRow(db, id: articleId) else { return nil }
                let articleUuid: String = articleRow["uuid"]
                return try CommentOutbox.createComment(
                    db,
                    issueUuid: articleUuid,
                    issueId: articleId,
                    bodyMd: request.bodyMd
                )
            }
            guard let local else { throw error }
            onLocalWrite()
            return local
        }
    }

    func updateComment(articleId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        if commentId < 0 {
            return try await localCommentUpdate(articleId: articleId, commentId: commentId, bodyMd: request.bodyMd)
        }
        do {
            return try await remote.updateComment(articleId: articleId, commentId: commentId, request)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            do {
                return try await localCommentUpdate(articleId: articleId, commentId: commentId, bodyMd: request.bodyMd)
            } catch is LocalMemoError {
                throw error
            }
        }
    }

    func deleteComment(articleId: Int, commentId: Int) async throws {
        if commentId < 0 {
            try await localCommentDelete(articleId: articleId, commentId: commentId)
            return
        }
        do {
            try await remote.deleteComment(articleId: articleId, commentId: commentId)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            do {
                try await localCommentDelete(articleId: articleId, commentId: commentId)
            } catch is LocalMemoError {
                throw error
            }
        }
    }

    private func localCommentUpdate(articleId: Int, commentId: Int, bodyMd: String) async throws -> Comment {
        let updated: Comment = try await database.dbWriter.write { db in
            guard let articleRow = try LocalArticleStore.fetchArticleRow(db, id: articleId) else {
                throw LocalMemoError.commentNotFound
            }
            let articleUuid: String = articleRow["uuid"]
            return try CommentOutbox.updateComment(
                db,
                issueUuid: articleUuid,
                issueId: articleId,
                commentId: commentId,
                bodyMd: bodyMd
            )
        }
        onLocalWrite()
        return updated
    }

    private func localCommentDelete(articleId: Int, commentId: Int) async throws {
        try await database.dbWriter.write { db in
            guard let articleRow = try LocalArticleStore.fetchArticleRow(db, id: articleId) else {
                throw LocalMemoError.commentNotFound
            }
            let articleUuid: String = articleRow["uuid"]
            try CommentOutbox.deleteComment(db, issueUuid: articleUuid, commentId: commentId)
        }
        onLocalWrite()
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
