import Foundation
import GRDB

/// Issue共通のコピー・種別変更。呼び出し側が変換元の種別と操作の可否を検証する。
nonisolated enum LocalIssueConversionStore {
    static func copyToArticle(_ db: Database, source: IssueRecord) throws -> Int {
        let sourceUuid = source.uuid
        let targetUuid = UUIDv7.generate()
        let now = ISO8601Millis.now()
        let title = source.title
        let body = source.bodyMd
        let record = IssueRecord(uuid: targetUuid, serverId: nil, type: "article",
                                 title: title ?? "", bodyMd: body,
                                 meta: try LocalArticleStore.metaJSON(ArticleMeta(originalUrl: nil, siteName: nil, archivedAt: now)),
                                 createdAt: now, updatedAt: now)
        try record.insert(db)
        let targetId = -Int(db.lastInsertedRowID)
        let comments = try Row.fetchAll(db, sql: "SELECT * FROM comments WHERE issue_uuid = ? AND is_deleted = 0 ORDER BY created_at, rowid", arguments: [sourceUuid])
        for comment in comments {
            try LocalCommentStore.insertComment(db, uuid: UUIDv7.generate(), issueUuid: targetUuid,
                                                bodyMd: comment["body_md"], now: now)
        }
        try db.execute(sql: "INSERT INTO issue_labels (issue_uuid, label_name) SELECT ?, label_name FROM issue_labels WHERE issue_uuid = ?",
                       arguments: [targetUuid, sourceUuid])
        let links = try Row.fetchAll(db, sql: "SELECT * FROM links WHERE source_issue_uuid = ? OR target_issue_uuid = ?", arguments: [sourceUuid, sourceUuid])
        for link in links {
            let from: String = link["source_issue_uuid"]
            let to: String = link["target_issue_uuid"]
            let type: String = link["link_type"]
            try db.execute(sql: "INSERT INTO links (uuid, source_issue_uuid, target_issue_uuid, link_type, created_at) VALUES (?, ?, ?, ?, ?)",
                           arguments: [UUIDv7.generate(), from == sourceUuid ? targetUuid : from,
                                       to == sourceUuid ? targetUuid : to, type, now])
        }
        try db.execute(sql: "INSERT INTO links (uuid, source_issue_uuid, target_issue_uuid, link_type, created_at) VALUES (?, ?, ?, 'derived_from', ?)",
                       arguments: [UUIDv7.generate(), targetUuid, sourceUuid, now])
        let urls = try Row.fetchAll(db, sql: "SELECT * FROM url_links WHERE issue_uuid = ?", arguments: [sourceUuid])
        for url in urls {
            let value: String = url["url"]
            let title: String? = url["title"]
            try db.execute(sql: "INSERT INTO url_links (uuid, issue_uuid, url, title, created_at) VALUES (?, ?, ?, ?, ?)",
                           arguments: [UUIDv7.generate(), targetUuid, value, title, now])
        }
        return targetId
    }

    static func transferToMemo(_ db: Database, source: IssueRecord) throws {
        let uuid = source.uuid
        let title = source.title
        let body = source.bodyMd
        let memoBody = [title.map { "# \($0)" } ?? "", body].filter { !$0.isEmpty }.joined(separator: "\n\n")
        try db.execute(sql: """
            UPDATE issues SET type = 'memo', title = NULL, body_md = ?, status = NULL,
              scheduled_on = NULL, scheduled_start = NULL, scheduled_end = NULL, is_all_day = 0,
              actual_start = NULL, actual_end = NULL, start_time = NULL, end_time = NULL,
              end_date = NULL, duration = NULL, task_kind = NULL
            WHERE uuid = ?
            """, arguments: [memoBody, uuid])
    }
}
