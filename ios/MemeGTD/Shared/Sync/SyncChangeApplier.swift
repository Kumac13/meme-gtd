import Foundation
import GRDB

/// Applies one page of the server change feed (GET /api/sync/changes) to the
/// local GRDB mirror. Called by the SyncEngine inside a single write
/// transaction per page, so a page becomes visible atomically together with
/// the advanced cursor.
///
/// Rules (offline support plan S2):
/// - Match rows by uuid; store server ids; save the server `updatedAt` into
///   BOTH `updated_at` and `server_updated_at` (the row now mirrors the
///   server exactly, so the next local edit carries the right base).
/// - Sync-loop prevention: never touch a uuid that still has pending outbox
///   operations (the local intent has not been pushed yet; the next pull
///   after the push converges it), and never enqueue outbox entries here.
/// - Issue rows of type task/article are stored as-is: they seed the
///   read-only cache used by Phase 7.
/// - Labels / issue_labels are hard-deleted on the server, so their deletes
///   arrive as `op: delete` tombstones. Issues/comments soft-delete via
///   `isDeleted` upserts instead.
nonisolated enum SyncChangeApplier {
    /// Applies the changes inside the caller's transaction. `pendingUuids` is
    /// the set of `target_uuid`s that still have outbox rows (any state:
    /// queued, inflight, or failed — all represent un-pushed local intent).
    /// Returns the number of changes actually applied (skips excluded).
    static func apply(
        _ changes: [SyncChange],
        skippingUuids pendingUuids: Set<String>,
        in db: Database
    ) throws -> Int {
        var appliedCount = 0
        for change in changes {
            let applied: Bool
            switch (change.entity, change.op) {
            case (.issue, .upsert):
                applied = try applyIssueUpsert(change, pendingUuids: pendingUuids, db: db)
            case (.comment, .upsert):
                applied = try applyCommentUpsert(change, pendingUuids: pendingUuids, db: db)
            case (.label, .upsert):
                applied = try applyLabelUpsert(change, db: db)
            case (.issueLabel, .upsert):
                applied = try applyIssueLabelUpsert(change, db: db)
            case (.label, .delete):
                applied = try applyLabelDelete(change, db: db)
            case (.issueLabel, .delete):
                applied = try applyIssueLabelDelete(change, db: db)
            case (.issue, .delete), (.comment, .delete):
                // Issues/comments never hard-delete on the server; their
                // soft-deleted rows arrive as upserts with isDeleted=true.
                applied = false
            }
            if applied {
                appliedCount += 1
            }
        }
        return appliedCount
    }

    // MARK: - Upserts

    private static func applyIssueUpsert(
        _ change: SyncChange,
        pendingUuids: Set<String>,
        db: Database
    ) throws -> Bool {
        let data = change.data
        guard let uuid = string(data, "uuid") else { return false }
        // Sync-loop prevention: local pending edits win until they are pushed.
        if pendingUuids.contains(uuid) { return false }

        let updatedAt = string(data, "updatedAt") ?? string(data, "createdAt") ?? ""
        try db.execute(
            sql: """
                INSERT INTO issues (
                  uuid, server_id, type, title, body_md, status,
                  scheduled_on, scheduled_start, scheduled_end, is_all_day,
                  actual_start, actual_end, start_time, end_time, end_date,
                  duration, task_kind, meta, is_bookmarked, is_deleted,
                  created_at, updated_at, server_updated_at, server_seq
                ) VALUES (
                  :uuid, :serverId, :type, :title, :bodyMd, :status,
                  :scheduledOn, :scheduledStart, :scheduledEnd, :isAllDay,
                  :actualStart, :actualEnd, :startTime, :endTime, :endDate,
                  :duration, :taskKind, :meta, :isBookmarked, :isDeleted,
                  :createdAt, :updatedAt, :serverUpdatedAt, :serverSeq
                )
                ON CONFLICT(uuid) DO UPDATE SET
                  server_id = excluded.server_id,
                  type = excluded.type,
                  title = excluded.title,
                  body_md = excluded.body_md,
                  status = excluded.status,
                  scheduled_on = excluded.scheduled_on,
                  scheduled_start = excluded.scheduled_start,
                  scheduled_end = excluded.scheduled_end,
                  is_all_day = excluded.is_all_day,
                  actual_start = excluded.actual_start,
                  actual_end = excluded.actual_end,
                  start_time = excluded.start_time,
                  end_time = excluded.end_time,
                  end_date = excluded.end_date,
                  duration = excluded.duration,
                  task_kind = excluded.task_kind,
                  meta = excluded.meta,
                  is_bookmarked = excluded.is_bookmarked,
                  is_deleted = excluded.is_deleted,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at,
                  server_updated_at = excluded.server_updated_at,
                  server_seq = excluded.server_seq
                """,
            arguments: [
                "uuid": uuid,
                "serverId": int(data, "id"),
                "type": string(data, "type") ?? "memo",
                "title": string(data, "title"),
                "bodyMd": string(data, "bodyMd") ?? "",
                "status": string(data, "status"),
                "scheduledOn": string(data, "scheduledOn"),
                "scheduledStart": string(data, "scheduledStart"),
                "scheduledEnd": string(data, "scheduledEnd"),
                "isAllDay": bool(data, "isAllDay"),
                "actualStart": string(data, "actualStart"),
                "actualEnd": string(data, "actualEnd"),
                "startTime": string(data, "startTime"),
                "endTime": string(data, "endTime"),
                "endDate": string(data, "endDate"),
                "duration": int(data, "duration"),
                "taskKind": string(data, "taskKind"),
                "meta": jsonString(data, "meta"),
                "isBookmarked": bool(data, "isBookmarked"),
                "isDeleted": bool(data, "isDeleted"),
                "createdAt": string(data, "createdAt") ?? updatedAt,
                "updatedAt": updatedAt,
                "serverUpdatedAt": updatedAt,
                "serverSeq": change.serverSeq,
            ]
        )
        return true
    }

    private static func applyCommentUpsert(
        _ change: SyncChange,
        pendingUuids: Set<String>,
        db: Database
    ) throws -> Bool {
        let data = change.data
        guard let uuid = string(data, "uuid") else { return false }
        if pendingUuids.contains(uuid) { return false }
        // issueUuid can be null when the parent issue row is gone server-side
        // (LEFT JOIN); such a comment cannot be anchored locally.
        guard let issueUuid = string(data, "issueUuid") else { return false }

        let updatedAt = string(data, "updatedAt") ?? string(data, "createdAt") ?? ""
        try db.execute(
            sql: """
                INSERT INTO comments (
                  uuid, server_id, issue_uuid, body_md,
                  created_at, updated_at, server_updated_at, is_deleted
                ) VALUES (
                  :uuid, :serverId, :issueUuid, :bodyMd,
                  :createdAt, :updatedAt, :serverUpdatedAt, :isDeleted
                )
                ON CONFLICT(uuid) DO UPDATE SET
                  server_id = excluded.server_id,
                  issue_uuid = excluded.issue_uuid,
                  body_md = excluded.body_md,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at,
                  server_updated_at = excluded.server_updated_at,
                  is_deleted = excluded.is_deleted
                """,
            arguments: [
                "uuid": uuid,
                "serverId": int(data, "id"),
                "issueUuid": issueUuid,
                "bodyMd": string(data, "bodyMd") ?? "",
                "createdAt": string(data, "createdAt") ?? updatedAt,
                "updatedAt": updatedAt,
                "serverUpdatedAt": updatedAt,
                "isDeleted": bool(data, "isDeleted"),
            ]
        )
        return true
    }

    private static func applyLabelUpsert(_ change: SyncChange, db: Database) throws -> Bool {
        let data = change.data
        guard let name = string(data, "name") else { return false }
        try db.execute(
            sql: """
                INSERT INTO labels (name, server_id, description, created_at)
                VALUES (:name, :serverId, :description, :createdAt)
                ON CONFLICT(name) DO UPDATE SET
                  server_id = excluded.server_id,
                  description = excluded.description,
                  created_at = excluded.created_at
                """,
            arguments: [
                "name": name,
                "serverId": int(data, "id"),
                "description": string(data, "description"),
                "createdAt": string(data, "createdAt") ?? "",
            ]
        )
        return true
    }

    private static func applyIssueLabelUpsert(_ change: SyncChange, db: Database) throws -> Bool {
        let data = change.data
        // Both human keys are resolved by the server via JOINs; either can be
        // null if the referenced row disappeared before the feed was read.
        guard let issueUuid = string(data, "issueUuid"),
              let labelName = string(data, "labelName") else { return false }
        try db.execute(
            sql: """
                INSERT OR REPLACE INTO issue_labels (issue_uuid, label_name)
                VALUES (?, ?)
                """,
            arguments: [issueUuid, labelName]
        )
        return true
    }

    // MARK: - Tombstones (labels / issue_labels only)

    private static func applyLabelDelete(_ change: SyncChange, db: Database) throws -> Bool {
        let data = change.data
        if let labelName = string(data, "labelName") {
            // Cascade: drop the label and any local assignments of it.
            try db.execute(
                sql: "DELETE FROM issue_labels WHERE label_name = ?",
                arguments: [labelName]
            )
            try db.execute(sql: "DELETE FROM labels WHERE name = ?", arguments: [labelName])
            return true
        }
        if let labelId = int(data, "labelId") {
            try db.execute(
                sql: """
                    DELETE FROM issue_labels
                    WHERE label_name IN (SELECT name FROM labels WHERE server_id = ?)
                    """,
                arguments: [labelId]
            )
            try db.execute(sql: "DELETE FROM labels WHERE server_id = ?", arguments: [labelId])
            return true
        }
        return false
    }

    private static func applyIssueLabelDelete(_ change: SyncChange, db: Database) throws -> Bool {
        let data = change.data
        guard let issueUuid = string(data, "issueUuid") else { return false }
        if let labelName = string(data, "labelName") {
            try db.execute(
                sql: "DELETE FROM issue_labels WHERE issue_uuid = ? AND label_name = ?",
                arguments: [issueUuid, labelName]
            )
            return true
        }
        if let labelId = int(data, "labelId") {
            // labelName is null when the parent label was CASCADE-deleted in
            // the same server transaction; resolve through server_id, and let
            // the accompanying 'label' tombstone clean up the rest.
            try db.execute(
                sql: """
                    DELETE FROM issue_labels
                    WHERE issue_uuid = ?
                      AND label_name IN (SELECT name FROM labels WHERE server_id = ?)
                    """,
                arguments: [issueUuid, labelId]
            )
            return true
        }
        return false
    }

    // MARK: - JSON value extraction

    private static func string(_ data: [String: SyncJSONValue], _ key: String) -> String? {
        if case .string(let value)? = data[key] { return value }
        return nil
    }

    private static func int(_ data: [String: SyncJSONValue], _ key: String) -> Int? {
        if case .number(let value)? = data[key] { return Int(value) }
        return nil
    }

    private static func bool(_ data: [String: SyncJSONValue], _ key: String) -> Bool {
        switch data[key] {
        case .bool(let value): return value
        case .number(let value): return value != 0
        default: return false
        }
    }

    /// Re-serializes a JSON object/array value (e.g. issue `meta`) into the
    /// TEXT column format the local schema mirrors from the server.
    private static func jsonString(_ data: [String: SyncJSONValue], _ key: String) -> String? {
        guard let value = data[key] else { return nil }
        if case .null = value { return nil }
        guard let encoded = try? JSONEncoder().encode(value) else { return nil }
        return String(data: encoded, encoding: .utf8)
    }
}
