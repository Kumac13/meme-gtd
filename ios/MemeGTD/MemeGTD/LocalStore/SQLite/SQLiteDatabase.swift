import Foundation
import SQLite3
import os

/// Thin wrapper around the iOS-bundled SQLite3 C API. Owns one connection
/// handle, serializes writes via a single GCD queue, and provides ergonomic
/// helpers that hide the C pointer arithmetic from repositories.
///
/// We deliberately do NOT depend on GRDB.swift or SQLite.swift: keeping the
/// runtime dependency surface at zero means no Xcode project (pbxproj) edits
/// are needed to ship offline support.
final class SQLiteDatabase {
    private static let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "SQLite")

    // SQLITE_TRANSIENT tells SQLite to copy the buffer before returning from
    // sqlite3_bind_text. Without it, the buffer pointer could go stale before
    // step() runs and we'd read garbage.
    static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    private let path: String
    private let handle: OpaquePointer
    private let queue: DispatchQueue
    private let queueKey = DispatchSpecificKey<Bool>()

    /// Opens (or creates) the SQLite file at `path`. WAL mode is enabled so
    /// that read transactions don't block writes — important because the iOS
    /// UI repeatedly reads while the SyncEngine is writing.
    init(path: String) throws {
        var handle: OpaquePointer?
        let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX
        let rc = sqlite3_open_v2(path, &handle, flags, nil)
        guard rc == SQLITE_OK, let opened = handle else {
            let message = handle.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "unknown error"
            if let opened = handle { sqlite3_close_v2(opened) }
            throw SQLiteError.open(path: path, code: rc, message: message)
        }
        self.path = path
        self.handle = opened
        self.queue = DispatchQueue(label: "name.kumac.MemeGTD.SQLite.\((path as NSString).lastPathComponent)")
        self.queue.setSpecific(key: queueKey, value: true)

        // WAL + foreign keys + busy timeout — same posture the server uses.
        try execute("PRAGMA journal_mode = WAL;")
        try execute("PRAGMA foreign_keys = ON;")
        try execute("PRAGMA busy_timeout = 5000;")
    }

    /// Runs `block` on the serialization queue, but only enters `queue.sync`
    /// if we aren't already on it. Without this, `transaction { execute(...) }`
    /// deadlocks: the outer transaction holds the queue and the inner execute
    /// tries to acquire the same queue from the same thread.
    private func runOnQueue<T>(_ block: () throws -> T) rethrows -> T {
        if DispatchQueue.getSpecific(key: queueKey) == true {
            return try block()
        }
        return try queue.sync(execute: block)
    }

    deinit {
        sqlite3_close_v2(handle)
    }

    var lastErrorMessage: String {
        String(cString: sqlite3_errmsg(handle))
    }

    /// Executes one or more SQL statements that take no parameters and return
    /// no rows — DDL, PRAGMA, etc. For parameterized writes use `write(_:bind:)`.
    func execute(_ sql: String) throws {
        try runOnQueue {
            let rc = sqlite3_exec(handle, sql, nil, nil, nil)
            guard rc == SQLITE_OK else {
                throw SQLiteError.step(sql: sql, code: rc, message: lastErrorMessage)
            }
        }
    }

    /// Prepares and runs a single statement that doesn't return rows
    /// (INSERT/UPDATE/DELETE). Returns the rowid of the last inserted row,
    /// which is mostly useful for autoincrement tables — the local schema
    /// uses ULID primary keys so callers usually ignore this.
    @discardableResult
    func write(_ sql: String, bind: (SQLiteStatement) throws -> Void = { _ in }) throws -> Int64 {
        try runOnQueue {
            let stmt = try SQLiteStatement(database: handle, sql: sql)
            defer { stmt.finalize() }
            try bind(stmt)
            try stmt.step()
            return sqlite3_last_insert_rowid(handle)
        }
    }

    /// Prepared query — calls `rowHandler` once per result row. The closure
    /// runs on the queue serializing all DB access, so it must not call back
    /// into the database (would deadlock) and should keep its work tiny.
    func query(
        _ sql: String,
        bind: (SQLiteStatement) throws -> Void = { _ in },
        rowHandler: (SQLiteStatement) throws -> Void
    ) throws {
        try runOnQueue {
            let stmt = try SQLiteStatement(database: handle, sql: sql)
            defer { stmt.finalize() }
            try bind(stmt)
            while try stmt.stepRow() {
                try rowHandler(stmt)
            }
        }
    }

    /// Reads a single integer from a one-row, one-column query (typically
    /// `PRAGMA user_version` or `SELECT COUNT(*) ...`).
    func scalarInt(_ sql: String, bind: (SQLiteStatement) throws -> Void = { _ in }) throws -> Int64 {
        var result: Int64 = 0
        try query(sql, bind: bind) { row in
            result = row.int64(at: 0)
        }
        return result
    }

    /// Runs `work` inside a SAVEPOINT named "tx". On throw, rolls back;
    /// on success, releases. Using SAVEPOINTs (not BEGIN/COMMIT) means we
    /// stay safe even if `work` is called while an outer transaction is
    /// already open — which can happen during migrations.
    func transaction<T>(_ work: () throws -> T) throws -> T {
        try runOnQueue {
            let rc = sqlite3_exec(handle, "SAVEPOINT tx;", nil, nil, nil)
            guard rc == SQLITE_OK else {
                throw SQLiteError.step(sql: "SAVEPOINT tx;", code: rc, message: lastErrorMessage)
            }
            do {
                let value = try work()
                let release = sqlite3_exec(handle, "RELEASE SAVEPOINT tx;", nil, nil, nil)
                if release != SQLITE_OK {
                    throw SQLiteError.step(sql: "RELEASE SAVEPOINT tx;", code: release, message: lastErrorMessage)
                }
                return value
            } catch {
                sqlite3_exec(handle, "ROLLBACK TO SAVEPOINT tx; RELEASE SAVEPOINT tx;", nil, nil, nil)
                throw error
            }
        }
    }
}
