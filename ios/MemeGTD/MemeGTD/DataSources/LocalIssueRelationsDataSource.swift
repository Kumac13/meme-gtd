import Foundation
import GRDB

/// Error carrying the server's validation messages for local link operations
/// (English, user-facing, same wording as LinkService / urlLinkRepository).
nonisolated struct LocalIssueRelationsError: Error, LocalizedError {
    let message: String

    init(_ message: String) {
        self.message = message
    }

    var errorDescription: String? { message }
}

/// Standalone-mode `IssueRelationsDataSource` (offline support plan Phase 9),
/// active while Storage Mode is "Standalone".
///
/// Issue-to-issue links and URL links live in the local `links` / `url_links`
/// tables (AppDatabase migration 003_links); both reads and creates/deletes
/// work fully locally. Links are not part of the sync change feed, so these
/// tables only ever contain rows created in Standalone mode.
///
/// createLink ports the LinkService validations that need no graph traversal
/// (self-reference, existence, duplicate). The inverse parent-child and
/// circular-hierarchy checks are NOT ported — the recursive ancestor walk is
/// server logic out of scope for this phase.
///
/// The activity log is server-computed and answers an empty timeline.
nonisolated final class LocalIssueRelationsDataSource: IssueRelationsDataSource {
    private let database: AppDatabase

    init(database: AppDatabase) {
        self.database = database
    }

    // MARK: - Issue resolution

    /// Minimal issue row for link purposes: local uuid + the integer id the
    /// protocol speaks (server_id or -rowid) + display fields.
    private struct IssueRef {
        let uuid: String
        let id: Int
        let type: String
        let title: String
        let status: String?
    }

    private static let issueSelect = """
        SELECT i.rowid AS local_rowid, i.uuid, i.server_id, i.type, i.status,
          COALESCE(i.title, SUBSTR(i.body_md, 1, 100)) AS display_title
        FROM issues i
        """

    private static func issueRef(from row: Row) -> IssueRef {
        let serverId: Int? = row["server_id"]
        let rowid: Int64 = row["local_rowid"]
        return IssueRef(
            uuid: row["uuid"],
            id: serverId ?? -Int(rowid),
            type: row["type"],
            title: row["display_title"] ?? "",
            status: row["status"]
        )
    }

    /// Resolves the protocol's integer issue id (positive = server_id,
    /// negative = -rowid), excluding deleted rows — the same visibility rule
    /// LinkService applies.
    private static func fetchIssue(_ db: Database, id: Int) throws -> IssueRef? {
        let row: Row?
        if id > 0 {
            row = try Row.fetchOne(
                db,
                sql: issueSelect + " WHERE i.server_id = ? AND i.is_deleted = 0",
                arguments: [id]
            )
        } else {
            row = try Row.fetchOne(
                db,
                sql: issueSelect + " WHERE i.rowid = ? AND i.is_deleted = 0",
                arguments: [-id]
            )
        }
        return row.map(issueRef(from:))
    }

    private static func fetchIssue(_ db: Database, uuid: String) throws -> IssueRef? {
        let row = try Row.fetchOne(
            db,
            sql: issueSelect + " WHERE i.uuid = ? AND i.is_deleted = 0",
            arguments: [uuid]
        )
        return row.map(issueRef(from:))
    }

    // MARK: - Issue links

    func listLinks(issueId: Int) async throws -> [IssueLink] {
        try await database.dbWriter.read { db in
            guard let issue = try Self.fetchIssue(db, id: issueId) else { return [] }

            // Same order as linkRepository.listLinks: created_at ASC, both
            // directions.
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT l.rowid AS local_rowid, l.*
                    FROM links l
                    WHERE l.source_issue_uuid = ? OR l.target_issue_uuid = ?
                    ORDER BY l.created_at ASC
                    """,
                arguments: [issue.uuid, issue.uuid]
            )

            return try rows.compactMap { row -> IssueLink? in
                let sourceUuid: String = row["source_issue_uuid"]
                let targetUuid: String = row["target_issue_uuid"]
                let direction: LinkDirection = sourceUuid == issue.uuid ? .outgoing : .incoming
                let otherUuid = direction == .outgoing ? targetUuid : sourceUuid

                // A dangling link (counterpart hard-deleted) has no integer
                // id to surface; drop it from the list.
                guard let other = try Self.fetchIssue(db, uuid: otherUuid) else { return nil }

                let serverId: Int? = row["server_id"]
                let rowid: Int64 = row["local_rowid"]
                let rawType: String = row["link_type"]
                guard let linkType = LinkType(rawValue: rawType) else { return nil }

                return IssueLink(
                    id: serverId ?? -Int(rowid),
                    sourceIssueId: direction == .outgoing ? issue.id : other.id,
                    targetIssueId: direction == .outgoing ? other.id : issue.id,
                    linkType: linkType,
                    createdAt: row["created_at"],
                    direction: direction,
                    targetIssue: TargetIssue(
                        id: other.id,
                        type: other.type,
                        title: other.title,
                        status: other.status
                    )
                )
            }
        }
    }

    func createLink(_ request: CreateLinkRequest) async throws -> CreateLinkResponse {
        let uuid = UUIDv7.generate()
        let now = ISO8601Millis.now()

        return try await database.dbWriter.write { db in
            // LinkService validations 1-4 (same messages).
            if request.sourceIssueId == request.targetIssueId {
                throw LocalIssueRelationsError("Cannot link issue to itself (ID: \(request.sourceIssueId))")
            }
            guard let source = try Self.fetchIssue(db, id: request.sourceIssueId) else {
                throw LocalIssueRelationsError("Issue #\(request.sourceIssueId) not found")
            }
            guard let target = try Self.fetchIssue(db, id: request.targetIssueId) else {
                throw LocalIssueRelationsError("Issue #\(request.targetIssueId) not found")
            }
            let duplicate = try Row.fetchOne(
                db,
                sql: """
                    SELECT 1 FROM links
                    WHERE source_issue_uuid = ? AND target_issue_uuid = ? AND link_type = ?
                    LIMIT 1
                    """,
                arguments: [source.uuid, target.uuid, request.linkType.rawValue]
            )
            if duplicate != nil {
                throw LocalIssueRelationsError(
                    "Link already exists (source: \(request.sourceIssueId), target: \(request.targetIssueId), type: \(request.linkType.rawValue))"
                )
            }

            try db.execute(
                sql: """
                    INSERT INTO links (uuid, server_id, source_issue_uuid, target_issue_uuid, link_type, created_at)
                    VALUES (?, NULL, ?, ?, ?, ?)
                    """,
                arguments: [uuid, source.uuid, target.uuid, request.linkType.rawValue, now]
            )
            let rowid = try Int64.fetchOne(
                db,
                sql: "SELECT rowid FROM links WHERE uuid = ?",
                arguments: [uuid]
            ) ?? 0

            return CreateLinkResponse(
                id: -Int(rowid),
                sourceIssueId: request.sourceIssueId,
                targetIssueId: request.targetIssueId,
                linkType: request.linkType,
                createdAt: now
            )
        }
    }

    func deleteLink(linkId: Int) async throws {
        try await database.dbWriter.write { db in
            if linkId > 0 {
                try db.execute(sql: "DELETE FROM links WHERE server_id = ?", arguments: [linkId])
            } else {
                try db.execute(sql: "DELETE FROM links WHERE rowid = ?", arguments: [-linkId])
            }
            if db.changesCount == 0 {
                throw LocalIssueRelationsError("Link #\(linkId) not found")
            }
        }
    }

    // MARK: - URL links

    func listUrlLinks(issueId: Int) async throws -> [UrlLink] {
        try await database.dbWriter.read { db in
            guard let issue = try Self.fetchIssue(db, id: issueId) else { return [] }

            // Same order as urlLinkRepository.listUrlLinks: created_at ASC.
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT u.rowid AS local_rowid, u.*
                    FROM url_links u
                    WHERE u.issue_uuid = ?
                    ORDER BY u.created_at ASC
                    """,
                arguments: [issue.uuid]
            )
            return rows.map { row in
                let serverId: Int? = row["server_id"]
                let rowid: Int64 = row["local_rowid"]
                return UrlLink(
                    id: serverId ?? -Int(rowid),
                    issueId: issueId,
                    url: row["url"],
                    title: row["title"],
                    createdAt: row["created_at"]
                )
            }
        }
    }

    func createUrlLink(issueId: Int, _ request: CreateUrlLinkRequest) async throws -> UrlLink {
        let uuid = UUIDv7.generate()
        let now = ISO8601Millis.now()

        return try await database.dbWriter.write { db in
            guard let issue = try Self.fetchIssue(db, id: issueId) else {
                throw LocalIssueRelationsError("Issue #\(issueId) not found")
            }
            try db.execute(
                sql: """
                    INSERT INTO url_links (uuid, server_id, issue_uuid, url, title, created_at)
                    VALUES (?, NULL, ?, ?, ?, ?)
                    """,
                arguments: [uuid, issue.uuid, request.url, request.title, now]
            )
            let rowid = try Int64.fetchOne(
                db,
                sql: "SELECT rowid FROM url_links WHERE uuid = ?",
                arguments: [uuid]
            ) ?? 0

            return UrlLink(
                id: -Int(rowid),
                issueId: issueId,
                url: request.url,
                title: request.title,
                createdAt: now
            )
        }
    }

    func deleteUrlLink(urlLinkId: Int) async throws {
        try await database.dbWriter.write { db in
            if urlLinkId > 0 {
                try db.execute(sql: "DELETE FROM url_links WHERE server_id = ?", arguments: [urlLinkId])
            } else {
                try db.execute(sql: "DELETE FROM url_links WHERE rowid = ?", arguments: [-urlLinkId])
            }
            if db.changesCount == 0 {
                throw LocalIssueRelationsError("URL link #\(urlLinkId) not found")
            }
        }
    }

    // MARK: - Activity log (server-only)

    func listActivityLog(issueId: Int) async throws -> [ActivityLogEntry] { [] }
}
