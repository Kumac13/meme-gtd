import Foundation
import GRDB

/// 同期済みの本文・コメントを端末から読み、記録を永続キューに追加する。
nonisolated final class OfflineFirstArticleDataSource: ArticleDataSource {
    private let threads: OfflineThreadStore
    private let database: AppDatabase
    private let remote: ArticleDataSource

    private let onLocalWrite: () -> Void

    init(database: AppDatabase, remote: ArticleDataSource, onLocalWrite: @escaping () -> Void = {}) {
        self.onLocalWrite = onLocalWrite
        self.threads = OfflineThreadStore(database: database, onLocalWrite: onLocalWrite)
        self.database = database
        self.remote = remote
    }

    // MARK: - Reads (remote first, local fallback)

    func listArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse {
        let supported = ["limit", "offset", "origin", "search", "label", "projectId", "bookmarked"]
        if queryItems.allSatisfy({ supported.contains($0.name) }) {
            let local = try await localListArticles(queryItems: queryItems)
            if local.total > 0 || database.hasCompletedPull { return local }
        }
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
        if let local = try await database.dbWriter.read({ db -> Article? in
            guard let row = try LocalArticleStore.fetchArticleRow(db, id: id) else { return nil }
            return try LocalArticleStore.article(from: row, db: db)
        }) { return local }
        return try await threads.loadBeforeInitialPull(kind: "article", id: id) { try await remote.getArticle(id: id) }
    }

    // MARK: - Writes

    func createArticle(_ request: CreateManualArticleRequest) async throws -> Article {
        let article = try await database.dbWriter.write { db in
            let uuid = UUIDv7.generate()
            let now = ISO8601Millis.now()
            try LocalArticleStore.insertArticle(db, uuid: uuid, title: request.title, bodyMd: request.bodyMd,
                                               originalUrl: nil, siteName: nil, now: now)
            try OfflineThreadStore.enqueue(db, entity: .article, uuid: uuid,
                payload: SyncPushPayload(bodyMd: request.bodyMd, createdAt: now, title: request.title, origin: "manual"), now: now)
            for label in Set(request.labels ?? []).sorted() {
                try db.execute(sql: "INSERT OR IGNORE INTO issue_labels(issue_uuid, label_name) VALUES (?, ?)", arguments: [uuid, label])
                try OfflineThreadStore.enqueue(db, entity: .issueLabel, uuid: UUIDv7.generate(),
                    payload: SyncPushPayload(issueUuid: uuid, labelName: label), now: now)
            }
            try OfflineThreadStore.saveProjects(db, ids: request.projectIds ?? [], uuid: uuid)
            guard let row = try Row.fetchOne(db, sql: LocalArticleStore.rowSelect + " WHERE i.uuid = ?", arguments: [uuid]) else {
                throw LocalArticleError.articleNotFound
            }
            return try LocalArticleStore.article(from: row, db: db)
        }
        onLocalWrite()
        return article
    }

    func updateArticle(id: Int, _ request: UpdateArticleRequest) async throws -> Article {
        let resolved = try await threads.serverIssueID(id)
        return try await onlineWrite { try await remote.updateArticle(id: resolved, request) }
    }

    func bookmarkArticle(id: Int) async throws -> Article {
        let resolved = try await threads.serverIssueID(id)
        return try await onlineWrite { try await remote.bookmarkArticle(id: resolved) }
    }

    func unbookmarkArticle(id: Int) async throws -> Article {
        let resolved = try await threads.serverIssueID(id)
        return try await onlineWrite { try await remote.unbookmarkArticle(id: resolved) }
    }

    func listComments(articleId: Int) async throws -> [Comment] {
        try await threads.comments(id: articleId) { try await remote.listComments(articleId: articleId) }
    }

    func createComment(articleId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        try await threads.add(id: articleId, body: request.bodyMd)
    }

    func updateComment(articleId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        try await threads.edit(id: articleId, commentID: commentId, body: request.bodyMd)
    }

    func deleteComment(articleId: Int, commentId: Int) async throws {
        let parent = try await threads.serverIssueID(articleId)
        let resolved = try await threads.serverCommentID(commentId, parentID: parent)
        return try await onlineWrite { try await remote.deleteComment(articleId: parent, commentId: resolved) }
    }

    func deleteArticle(id: Int) async throws {
        let resolved = try await threads.serverIssueID(id)
        do {
            try await remote.deleteArticle(id: resolved)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            throw OfflineReadOnlyError()
        }
    }

    private func onlineWrite<T>(_ operation: () async throws -> T) async throws -> T {
        do {
            let result = try await operation()
            onLocalWrite()
            return result
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
