import Foundation
import GRDB

/// Error thrown by Standalone-mode data sources when a server-only feature is
/// invoked (offline support plan Phase 8). English, user-facing.
nonisolated struct StandaloneUnavailableError: Error, LocalizedError {
    let message: String

    /// - Parameter message: full sentence, e.g. "Promote is not available in
    ///   Standalone mode." (kept free-form so plural subjects read naturally).
    init(_ message: String) {
        self.message = message
    }

    var errorDescription: String? { message }
}

// MARK: - Labels (served from the local mirror)

/// Standalone `LabelDataSource`: list is served from the local `labels`
/// mirror (whatever a previous sync pulled, or nothing on a fresh install) so
/// the memo label-filter picker keeps working without a server. Creating and
/// (un)assigning labels are server writes with no outbox path and are refused.
nonisolated final class LocalLabelDataSource: LabelDataSource {
    private let database: AppDatabase

    init(database: AppDatabase) {
        self.database = database
    }

    func listLabels() async throws -> [IssueLabel] {
        try await database.dbWriter.read { db in
            // Per-type usage counts mirror GET /api/labels (deleted issues
            // excluded), computed against the local issues mirror.
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT l.rowid AS local_rowid, l.name, l.server_id, l.description, l.created_at,
                      (SELECT COUNT(*) FROM issue_labels il
                       JOIN issues i ON i.uuid = il.issue_uuid
                       WHERE il.label_name = l.name AND i.type = 'memo' AND i.is_deleted = 0) AS memo_count,
                      (SELECT COUNT(*) FROM issue_labels il
                       JOIN issues i ON i.uuid = il.issue_uuid
                       WHERE il.label_name = l.name AND i.type = 'task' AND i.is_deleted = 0) AS task_count,
                      (SELECT COUNT(*) FROM issue_labels il
                       JOIN issues i ON i.uuid = il.issue_uuid
                       WHERE il.label_name = l.name AND i.type = 'article' AND i.is_deleted = 0) AS article_count
                    FROM labels l
                    ORDER BY l.created_at
                    """
            )
            return rows.map { row in
                let serverId: Int? = row["server_id"]
                let rowid: Int64 = row["local_rowid"]
                return IssueLabel(
                    id: serverId ?? -Int(rowid),
                    name: row["name"],
                    description: row["description"],
                    createdAt: row["created_at"],
                    memoCount: row["memo_count"],
                    taskCount: row["task_count"],
                    articleCount: row["article_count"]
                )
            }
        }
    }

    func createLabel(_ request: CreateLabelRequest) async throws -> IssueLabel {
        throw StandaloneUnavailableError("Creating labels is not available in Standalone mode.")
    }

    func assignLabel(issueId: Int, _ request: AssignLabelRequest) async throws -> AssignLabelResponse {
        throw StandaloneUnavailableError("Assigning labels is not available in Standalone mode.")
    }

    func removeLabel(issueId: Int, labelId: Int) async throws {
        throw StandaloneUnavailableError("Removing labels is not available in Standalone mode.")
    }
}

// MARK: - Tasks / Articles / Search / Projects / Relations (empty-safe)

/// Standalone stand-ins for the server-backed domains: list-style reads
/// answer empty pages so the Tasks/Articles screens render their (labelled)
/// empty state instead of erroring, and every write or by-id read throws the
/// user-facing unavailable error. Nothing here can reach
/// `APIError.noConfiguration` or crash without a server.

nonisolated struct EmptyTaskDataSource: TaskDataSource {
    func listTasks(queryItems: [URLQueryItem]) async throws -> TaskListResponse {
        TaskListResponse(data: [], total: 0, limit: 0, offset: 0)
    }

    func searchTasks(queryItems: [URLQueryItem]) async throws -> SearchTasksResponse {
        SearchTasksResponse(data: [], total: 0, limit: 0, offset: 0)
    }

    func getTask(id: Int) async throws -> TaskItem {
        throw StandaloneUnavailableError("Tasks are not available in Standalone mode.")
    }

    func createTask(_ request: CreateTaskRequest) async throws -> TaskItem {
        throw StandaloneUnavailableError("Creating tasks is not available in Standalone mode.")
    }

    func updateTask(id: Int, _ request: UpdateTaskRequest) async throws -> TaskItem {
        throw StandaloneUnavailableError("Editing tasks is not available in Standalone mode.")
    }

    func deleteTask(id: Int) async throws {
        throw StandaloneUnavailableError("Deleting tasks is not available in Standalone mode.")
    }

    func bookmarkTask(id: Int) async throws -> TaskItem {
        throw StandaloneUnavailableError("Bookmarking tasks is not available in Standalone mode.")
    }

    func unbookmarkTask(id: Int) async throws -> TaskItem {
        throw StandaloneUnavailableError("Bookmarking tasks is not available in Standalone mode.")
    }

    func listComments(taskId: Int) async throws -> [Comment] { [] }

    func createComment(taskId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        throw StandaloneUnavailableError("Commenting on tasks is not available in Standalone mode.")
    }

    func updateComment(taskId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        throw StandaloneUnavailableError("Commenting on tasks is not available in Standalone mode.")
    }

    func deleteComment(taskId: Int, commentId: Int) async throws {
        throw StandaloneUnavailableError("Commenting on tasks is not available in Standalone mode.")
    }
}

nonisolated struct EmptyArticleDataSource: ArticleDataSource {
    func listArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse {
        ArticleListResponse(data: [], total: 0, limit: 0, offset: 0)
    }

    func searchArticles(queryItems: [URLQueryItem]) async throws -> SearchArticlesResponse {
        SearchArticlesResponse(data: [], total: 0, limit: 0, offset: 0)
    }

    func getArticle(id: Int) async throws -> Article {
        throw StandaloneUnavailableError("Articles are not available in Standalone mode.")
    }

    func deleteArticle(id: Int) async throws {
        throw StandaloneUnavailableError("Deleting articles is not available in Standalone mode.")
    }
}

/// Keyword/semantic search stays server-backed until the local FTS lands
/// (Phase 9): both endpoints answer an empty result set so the search UI
/// shows "no results" instead of a configuration error.
nonisolated struct EmptySearchDataSource: SearchDataSource {
    func keywordSearch(queryItems: [URLQueryItem]) async throws -> KeywordSearchResponse {
        KeywordSearchResponse(results: [], total: 0, limit: 0, offset: 0)
    }

    func semanticSearch(queryItems: [URLQueryItem]) async throws -> SemanticSearchResponse {
        let query = queryItems.first(where: { $0.name == "q" })?.value ?? ""
        return SemanticSearchResponse(
            results: [],
            meta: SemanticSearchMeta(query: query, totalResults: 0, searchTimeMs: 0)
        )
    }

    func exportSearchResults(_ request: SearchExportRequest) async throws -> String {
        throw StandaloneUnavailableError("Export is not available in Standalone mode.")
    }
}

nonisolated struct EmptyProjectDataSource: ProjectDataSource {
    func listProjects() async throws -> [Project] { [] }

    func listIssueProjects(issueId: Int) async throws -> [Project] { [] }

    func addProjectItem(projectId: Int, _ request: AddProjectItemRequest) async throws -> ProjectItem {
        throw StandaloneUnavailableError("Projects are not available in Standalone mode.")
    }

    func removeProjectItem(projectId: Int, issueId: Int) async throws {
        throw StandaloneUnavailableError("Projects are not available in Standalone mode.")
    }
}

nonisolated struct EmptyIssueRelationsDataSource: IssueRelationsDataSource {
    func listLinks(issueId: Int) async throws -> [IssueLink] { [] }

    func createLink(_ request: CreateLinkRequest) async throws -> CreateLinkResponse {
        throw StandaloneUnavailableError("Linking issues is not available in Standalone mode.")
    }

    func deleteLink(linkId: Int) async throws {
        throw StandaloneUnavailableError("Linking issues is not available in Standalone mode.")
    }

    func listUrlLinks(issueId: Int) async throws -> [UrlLink] { [] }

    func createUrlLink(issueId: Int, _ request: CreateUrlLinkRequest) async throws -> UrlLink {
        throw StandaloneUnavailableError("URL links are not available in Standalone mode.")
    }

    func deleteUrlLink(urlLinkId: Int) async throws {
        throw StandaloneUnavailableError("URL links are not available in Standalone mode.")
    }

    func listActivityLog(issueId: Int) async throws -> [ActivityLogEntry] { [] }
}
