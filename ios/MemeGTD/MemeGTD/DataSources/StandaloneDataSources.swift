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

// MARK: - Labels (local mirror, fully read/write since Phase 9)

/// Error carrying the server's label validation messages (English,
/// user-facing, same wording as labelRepository.ts).
nonisolated struct LocalLabelError: Error, LocalizedError {
    let message: String

    init(_ message: String) {
        self.message = message
    }

    var errorDescription: String? { message }
}

/// Standalone `LabelDataSource`: list is served from the local `labels`
/// mirror (whatever a previous sync pulled, plus labels created on-device).
/// Since Phase 9 creating and (un)assigning labels also work locally,
/// mirroring labelRepository.ts semantics: create refuses duplicate names,
/// assign is idempotent (INSERT OR IGNORE), remove is idempotent but
/// validates that both the issue and the label exist.
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
        let now = ISO8601Millis.now()

        return try await database.dbWriter.write { db in
            // Name is the natural key; duplicate creation fails with the
            // server's message (labelRepository.createLabel).
            let existing = try Row.fetchOne(
                db,
                sql: "SELECT 1 FROM labels WHERE name = ?",
                arguments: [request.name]
            )
            if existing != nil {
                throw LocalLabelError("Label '\(request.name)' already exists")
            }

            let record = LabelRecord(
                name: request.name,
                serverId: nil,
                description: request.description,
                createdAt: now
            )
            try record.insert(db)

            let rowid = try Int64.fetchOne(
                db,
                sql: "SELECT rowid FROM labels WHERE name = ?",
                arguments: [request.name]
            ) ?? 0
            return IssueLabel(
                id: -Int(rowid),
                name: request.name,
                description: request.description,
                createdAt: now,
                memoCount: 0,
                taskCount: 0,
                articleCount: 0
            )
        }
    }

    func assignLabel(issueId: Int, _ request: AssignLabelRequest) async throws -> AssignLabelResponse {
        try await database.dbWriter.write { db in
            // Mirrors labelRepository.attachLabelToIssue: issue must exist
            // and not be deleted, label must exist, assignment is idempotent.
            guard let issueUuid = try Self.issueUuid(db, issueId: issueId) else {
                throw LocalLabelError("Issue #\(issueId) not found or deleted")
            }
            guard let labelName = try Self.labelName(db, labelId: request.labelId) else {
                throw LocalLabelError("Label #\(request.labelId) not found")
            }
            try db.execute(
                sql: "INSERT OR IGNORE INTO issue_labels (issue_uuid, label_name) VALUES (?, ?)",
                arguments: [issueUuid, labelName]
            )
            return AssignLabelResponse(success: true)
        }
    }

    func removeLabel(issueId: Int, labelId: Int) async throws {
        try await database.dbWriter.write { db in
            // Mirrors labelRepository.detachLabelFromIssue: validates both
            // sides exist, then deletes idempotently.
            guard let issueUuid = try Self.issueUuid(db, issueId: issueId) else {
                throw LocalLabelError("Issue #\(issueId) not found")
            }
            guard let labelName = try Self.labelName(db, labelId: labelId) else {
                throw LocalLabelError("Label #\(labelId) not found")
            }
            try db.execute(
                sql: "DELETE FROM issue_labels WHERE issue_uuid = ? AND label_name = ?",
                arguments: [issueUuid, labelName]
            )
        }
    }

    // MARK: - Id resolution (positive = server id, negative = -rowid)

    private static func issueUuid(_ db: Database, issueId: Int) throws -> String? {
        if issueId > 0 {
            return try String.fetchOne(
                db,
                sql: "SELECT uuid FROM issues WHERE server_id = ? AND is_deleted = 0",
                arguments: [issueId]
            )
        }
        return try String.fetchOne(
            db,
            sql: "SELECT uuid FROM issues WHERE rowid = ? AND is_deleted = 0",
            arguments: [-issueId]
        )
    }

    private static func labelName(_ db: Database, labelId: Int) throws -> String? {
        if labelId > 0 {
            return try String.fetchOne(
                db,
                sql: "SELECT name FROM labels WHERE server_id = ?",
                arguments: [labelId]
            )
        }
        return try String.fetchOne(
            db,
            sql: "SELECT name FROM labels WHERE rowid = ?",
            arguments: [-labelId]
        )
    }
}

// MARK: - Projects (empty-safe)

/// Standalone stand-in for the last still server-backed domain: list-style
/// reads answer empty pages so the UI renders its empty state instead of
/// erroring, and every write throws the user-facing unavailable error.
/// Nothing here can reach `APIError.noConfiguration` or crash without a
/// server. (Tasks, keyword search, and issue relations moved to real local
/// implementations in Phase 9, articles in Phase 10: LocalTaskDataSource /
/// LocalSearchDataSource / LocalIssueRelationsDataSource /
/// LocalArticleDataSource.)

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
