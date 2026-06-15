import Foundation
import os

/// Owns the on-device SQLite file used for offline memo capture, the outbox
/// of pending sync operations, and a read-only cache of server data.
///
/// Schema lives in `applyMigrations` rather than a folder of .sql files
/// because (a) the iOS schema is small and rarely changes and (b) bundling
/// loose .sql files into an app target adds Xcode Resources gymnastics we
/// can do without.
final class LocalDatabase {
    static let shared: LocalDatabase = {
        do { return try LocalDatabase() } catch {
            // If we can't even open the local DB, the app is unusable in
            // offline mode. Surface that loudly rather than failing silently.
            fatalError("LocalDatabase init failed: \(error)")
        }
    }()

    private static let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "LocalDatabase")
    private static let schemaVersion: Int64 = 1

    let sqlite: SQLiteDatabase

    init() throws {
        let url = try Self.resolveDatabaseURL()
        sqlite = try SQLiteDatabase(path: url.path)
        try applyMigrations()
    }

    /// Stored under Application Support so iOS doesn't purge it under storage
    /// pressure (Caches would be evicted) and so it's excluded from iCloud
    /// backups by default — we don't want a stale backup of pending memos
    /// surfacing on another device.
    private static func resolveDatabaseURL() throws -> URL {
        let fm = FileManager.default
        let support = try fm.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let dir = support.appendingPathComponent("MemeGTD", isDirectory: true)
        if !fm.fileExists(atPath: dir.path) {
            try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir.appendingPathComponent("local.sqlite")
    }

    // MARK: - Migrations

    private func applyMigrations() throws {
        let current = try sqlite.scalarInt("PRAGMA user_version;")
        if current >= Self.schemaVersion {
            return
        }
        Self.logger.info("Applying migrations: from v\(current) to v\(Self.schemaVersion)")

        try sqlite.transaction { [sqlite] in
            if current < 1 {
                try sqlite.execute(Self.v1Schema)
            }
            try sqlite.execute("PRAGMA user_version = \(Self.schemaVersion);")
        }
    }

    /// v1 schema: enough to support offline memo creation (`local_memos`),
    /// the sync queue (`outbox`), and read-only caches for everything else
    /// the UI shows. The cache tables are unpopulated until the cache-refresh
    /// sub-PR — but having them here means no follow-up migration is needed.
    private static let v1Schema = """
    CREATE TABLE IF NOT EXISTS local_memos (
        id            TEXT PRIMARY KEY,            -- ULID, doubles as server clientId
        server_id     INTEGER,                     -- nil until first sync; the server's INTEGER id
        body_md       TEXT NOT NULL,
        is_bookmarked INTEGER NOT NULL DEFAULT 0,
        is_deleted    INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        server_synced_at TEXT                      -- nil means pending sync
    );

    CREATE INDEX IF NOT EXISTS idx_local_memos_pending
        ON local_memos(server_synced_at)
        WHERE server_synced_at IS NULL;

    CREATE TABLE IF NOT EXISTS outbox (
        id              TEXT PRIMARY KEY,           -- ULID
        op_type         TEXT NOT NULL,              -- 'memo.create' for now
        target_id       TEXT NOT NULL,              -- local_memos.id (ULID)
        payload         TEXT NOT NULL,              -- JSON
        state           TEXT NOT NULL,              -- 'pending' | 'syncing' | 'failed'
        attempts        INTEGER NOT NULL DEFAULT 0,
        last_error      TEXT,
        created_at      TEXT NOT NULL,
        next_retry_at   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_pending_retry
        ON outbox(state, next_retry_at)
        WHERE state IN ('pending', 'failed');

    -- read-only caches; populated by cache-refresh, never written from UI
    CREATE TABLE IF NOT EXISTS local_tasks (
        id              INTEGER PRIMARY KEY,
        title           TEXT,
        body_md         TEXT,
        status          TEXT NOT NULL,
        task_kind       TEXT,
        scheduled_start TEXT,
        scheduled_end   TEXT,
        is_bookmarked   INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        fetched_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_articles (
        id            INTEGER PRIMARY KEY,
        title         TEXT NOT NULL,
        body_md       TEXT,
        original_url  TEXT,
        site_name     TEXT,
        is_bookmarked INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        fetched_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_projects (
        id          INTEGER PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        status      TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        fetched_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_labels (
        id         INTEGER PRIMARY KEY,
        name       TEXT NOT NULL UNIQUE,
        color      TEXT,
        fetched_at TEXT NOT NULL
    );
    """
}
