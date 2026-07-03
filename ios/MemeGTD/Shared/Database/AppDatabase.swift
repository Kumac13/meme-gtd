import Foundation
import GRDB
import os

private nonisolated let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "AppDatabase")

/// Local SQLite database mirroring the server schema (offline support plan S1).
///
/// The production database lives in the App Group container so that both the
/// app and the Share Extension can open it (the extension starts writing
/// articles locally in a later phase). Access goes through a WAL DatabasePool
/// for cross-process concurrency.
///
/// No screen reads from this database yet — the app only touches it at launch
/// so the file and schema exist for the upcoming sync phases.
nonisolated final class AppDatabase {
    /// App Group identifier (same value as Settings.swift).
    private static let appGroupIdentifier = "group.com.memegtd.app"

    /// The database connection: a DatabasePool (WAL) in production, an
    /// in-memory DatabaseQueue in unit tests.
    let dbWriter: any DatabaseWriter

    /// Opens the database through the given writer and applies migrations.
    init(_ dbWriter: any DatabaseWriter) throws {
        self.dbWriter = dbWriter
        try Self.migrator.migrate(dbWriter)
    }

    // MARK: - Production / test instances

    /// Shared production database stored in the App Group container at
    /// `Library/Application Support/MemeGTD/local.sqlite`.
    static let shared = makeShared()

    private static func makeShared() -> AppDatabase {
        do {
            guard let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: appGroupIdentifier
            ) else {
                // Missing App Group entitlement is a build/configuration bug,
                // not a recoverable user error.
                fatalError("App Group container \(appGroupIdentifier) is unavailable")
            }
            let directoryURL = containerURL
                .appendingPathComponent("Library", isDirectory: true)
                .appendingPathComponent("Application Support", isDirectory: true)
                .appendingPathComponent("MemeGTD", isDirectory: true)
            try FileManager.default.createDirectory(
                at: directoryURL,
                withIntermediateDirectories: true
            )
            let databaseURL = directoryURL.appendingPathComponent("local.sqlite")
            let dbPool = try DatabasePool(path: databaseURL.path)
            let database = try AppDatabase(dbPool)
            logger.info("Opened local database at \(databaseURL.path, privacy: .public)")
            return database
        } catch {
            fatalError("Failed to open local database: \(error)")
        }
    }

    /// In-memory database for unit tests.
    static func makeInMemory() throws -> AppDatabase {
        try AppDatabase(DatabaseQueue())
    }

    // MARK: - Migrations

    /// Numbered, append-only migrations mirroring the server `schema/`
    /// convention: never modify a registered migration, always add a new one.
    static var migrator: DatabaseMigrator {
        var migrator = DatabaseMigrator()

        migrator.registerMigration("001_initial") { db in
            // Single-table inheritance mirror of the server `issues` table
            // (memo / task / article). Primary key is a client-generated
            // UUIDv7; server_id is filled after the row reaches the server.
            try db.execute(sql: """
                CREATE TABLE issues (
                  uuid TEXT PRIMARY KEY,
                  server_id INTEGER UNIQUE,
                  type TEXT NOT NULL,
                  title TEXT,
                  body_md TEXT NOT NULL,
                  status TEXT,
                  scheduled_on TEXT,
                  scheduled_start TEXT,
                  scheduled_end TEXT,
                  is_all_day BOOLEAN NOT NULL DEFAULT 0,
                  actual_start TEXT,
                  actual_end TEXT,
                  start_time TEXT,
                  end_time TEXT,
                  end_date TEXT,
                  duration INTEGER,
                  task_kind TEXT,
                  meta TEXT,
                  is_bookmarked BOOLEAN NOT NULL DEFAULT 0,
                  is_deleted BOOLEAN NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL,
                  server_updated_at TEXT,
                  server_seq INTEGER
                )
                """)
            try db.execute(sql: """
                CREATE INDEX idx_issues_server_seq ON issues(server_seq)
                """)
            try db.execute(sql: """
                CREATE INDEX idx_issues_type_deleted_created
                ON issues(type, is_deleted, created_at)
                """)

            try db.execute(sql: """
                CREATE TABLE comments (
                  uuid TEXT PRIMARY KEY,
                  server_id INTEGER UNIQUE,
                  issue_uuid TEXT NOT NULL,
                  body_md TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL,
                  server_updated_at TEXT,
                  is_deleted BOOLEAN NOT NULL DEFAULT 0
                )
                """)
            try db.execute(sql: """
                CREATE INDEX idx_comments_issue_uuid ON comments(issue_uuid)
                """)

            // Labels are keyed by their natural key: name is UNIQUE on the
            // server, so it doubles as the local primary key.
            try db.execute(sql: """
                CREATE TABLE labels (
                  name TEXT PRIMARY KEY,
                  server_id INTEGER UNIQUE,
                  description TEXT,
                  created_at TEXT NOT NULL
                )
                """)

            try db.execute(sql: """
                CREATE TABLE issue_labels (
                  issue_uuid TEXT NOT NULL,
                  label_name TEXT NOT NULL,
                  PRIMARY KEY (issue_uuid, label_name)
                )
                """)

            // Outbox of local writes waiting to be pushed to the server
            // (offline support plan S2). id preserves FIFO order.
            try db.execute(sql: """
                CREATE TABLE pending_operations (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  op_id TEXT NOT NULL UNIQUE,
                  entity TEXT NOT NULL,
                  op_type TEXT NOT NULL,
                  target_uuid TEXT NOT NULL,
                  issue_uuid TEXT,
                  payload TEXT,
                  base_updated_at TEXT,
                  state TEXT NOT NULL DEFAULT 'queued',
                  retry_count INTEGER NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL
                )
                """)

            // Key-value store for sync bookkeeping (last_server_seq,
            // device_id, ...).
            try db.execute(sql: """
                CREATE TABLE sync_meta (
                  key TEXT PRIMARY KEY,
                  value TEXT NOT NULL
                )
                """)
        }

        migrator.registerMigration("002_projects_cache") { db in
            // Read-only snapshot of GET /api/projects (offline support plan
            // Phase 7). Projects are hard-deleted on the server and are not
            // part of the change feed, so every successful fetch replaces the
            // whole table (DELETE then INSERT) instead of merging.
            try db.execute(sql: """
                CREATE TABLE projects (
                  id INTEGER PRIMARY KEY,
                  name TEXT NOT NULL,
                  description TEXT,
                  status TEXT NOT NULL,
                  start_date TEXT,
                  end_date TEXT,
                  created_at TEXT NOT NULL
                )
                """)

            // Per-issue snapshot of GET /api/issues/{id}/projects: rows for an
            // issue are replaced whenever its memberships are fetched. Keys
            // are SERVER ids (projects never exist locally before syncing).
            try db.execute(sql: """
                CREATE TABLE project_items (
                  project_id INTEGER NOT NULL,
                  issue_id INTEGER NOT NULL,
                  PRIMARY KEY (project_id, issue_id)
                )
                """)
            try db.execute(sql: """
                CREATE INDEX idx_project_items_issue_id ON project_items(issue_id)
                """)
        }

        // NOTE: no local FTS index. Keyword search deliberately mirrors the
        // server's LIKE-based implementation (packages/db/CLAUDE.md: unicode61
        // cannot tokenize Japanese word boundaries) — see LocalSearchDataSource.

        migrator.registerMigration("003_links") { db in
            // Column-for-column mirror of the server `links` / `url_links`
            // tables (schema/001_init.sql, schema/011_add_url_links.sql),
            // with the identity swapped to the app-wide convention: PK is a
            // client-generated UUIDv7 with server_id alongside, and issues
            // are referenced by their uuid instead of the server integer id.
            // Links are not part of the sync change feed, so today these
            // tables only ever hold Standalone-created rows — the uuid PK is
            // chosen so local creation works and a future feed extension can
            // adopt the rows without a rekey.
            try db.execute(sql: """
                CREATE TABLE links (
                  uuid TEXT PRIMARY KEY,
                  server_id INTEGER UNIQUE,
                  source_issue_uuid TEXT NOT NULL,
                  target_issue_uuid TEXT NOT NULL,
                  link_type TEXT NOT NULL CHECK (link_type IN ('parent', 'child', 'relates', 'derived_from')),
                  created_at TEXT NOT NULL
                )
                """)
            try db.execute(sql: """
                CREATE INDEX idx_links_source_issue_uuid ON links(source_issue_uuid)
                """)
            try db.execute(sql: """
                CREATE INDEX idx_links_target_issue_uuid ON links(target_issue_uuid)
                """)

            try db.execute(sql: """
                CREATE TABLE url_links (
                  uuid TEXT PRIMARY KEY,
                  server_id INTEGER UNIQUE,
                  issue_uuid TEXT NOT NULL,
                  url TEXT NOT NULL,
                  title TEXT,
                  created_at TEXT NOT NULL
                )
                """)
            try db.execute(sql: """
                CREATE INDEX idx_url_links_issue_uuid ON url_links(issue_uuid)
                """)
        }

        return migrator
    }

    // MARK: - sync_meta helpers

    /// Reads a sync bookkeeping value, or nil when the key was never set.
    func syncMetaValue(for key: String) throws -> String? {
        try dbWriter.read { db in
            try String.fetchOne(
                db,
                sql: "SELECT value FROM sync_meta WHERE key = ?",
                arguments: [key]
            )
        }
    }

    /// Writes a sync bookkeeping value, overwriting any previous value.
    func setSyncMetaValue(_ value: String, for key: String) throws {
        try dbWriter.write { db in
            try db.execute(
                sql: """
                    INSERT INTO sync_meta (key, value) VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                    """,
                arguments: [key, value]
            )
        }
    }
}
