import Foundation
import SQLite3

/// Wraps a single `sqlite3_stmt*`. Owns finalization, provides parameter
/// binding (1-indexed per the C API) and column reading (0-indexed).
///
/// Repositories typically don't construct this directly — they call into
/// `SQLiteDatabase.write/query` which manages the lifecycle.
final class SQLiteStatement {
    private let sql: String
    private var stmt: OpaquePointer?
    private weak var ownerLog: AnyObject?

    init(database: OpaquePointer, sql: String) throws {
        self.sql = sql
        var raw: OpaquePointer?
        let rc = sqlite3_prepare_v2(database, sql, -1, &raw, nil)
        guard rc == SQLITE_OK, let prepared = raw else {
            let message = String(cString: sqlite3_errmsg(database))
            if let raw = raw { sqlite3_finalize(raw) }
            throw SQLiteError.prepare(sql: sql, code: rc, message: message)
        }
        self.stmt = prepared
    }

    deinit {
        finalize()
    }

    func finalize() {
        if let stmt = stmt {
            sqlite3_finalize(stmt)
            self.stmt = nil
        }
    }

    private func ensure() throws -> OpaquePointer {
        guard let stmt = stmt else {
            throw SQLiteError.step(sql: sql, code: -1, message: "statement finalized")
        }
        return stmt
    }

    // MARK: - Bind (1-indexed)

    func bind(_ index: Int32, _ value: String?) throws {
        let stmt = try ensure()
        let rc: Int32
        if let value = value {
            rc = sqlite3_bind_text(stmt, index, value, -1, SQLiteDatabase.transient)
        } else {
            rc = sqlite3_bind_null(stmt, index)
        }
        if rc != SQLITE_OK {
            throw SQLiteError.bind(sql: sql, code: rc, message: "bind text @\(index)")
        }
    }

    func bind(_ index: Int32, _ value: Int64?) throws {
        let stmt = try ensure()
        let rc: Int32 = value.map { sqlite3_bind_int64(stmt, index, $0) } ?? sqlite3_bind_null(stmt, index)
        if rc != SQLITE_OK {
            throw SQLiteError.bind(sql: sql, code: rc, message: "bind int @\(index)")
        }
    }

    func bind(_ index: Int32, _ value: Int?) throws {
        try bind(index, value.map(Int64.init))
    }

    func bind(_ index: Int32, _ value: Bool) throws {
        try bind(index, Int64(value ? 1 : 0))
    }

    // MARK: - Step

    /// For statements that don't return rows. Asserts that the step result
    /// is DONE; ROW from a step() call is treated as success too (the C API
    /// returns ROW for INSERT...RETURNING, which we don't currently use but
    /// might later).
    func step() throws {
        let stmt = try ensure()
        let rc = sqlite3_step(stmt)
        guard rc == SQLITE_DONE || rc == SQLITE_ROW else {
            let message = sqlite3_errmsg(sqlite3_db_handle(stmt)).map { String(cString: $0) } ?? "unknown"
            throw SQLiteError.step(sql: sql, code: rc, message: message)
        }
    }

    /// For SELECTs. Returns true while rows remain, false when exhausted.
    func stepRow() throws -> Bool {
        let stmt = try ensure()
        let rc = sqlite3_step(stmt)
        switch rc {
        case SQLITE_ROW: return true
        case SQLITE_DONE: return false
        default:
            let message = sqlite3_errmsg(sqlite3_db_handle(stmt)).map { String(cString: $0) } ?? "unknown"
            throw SQLiteError.step(sql: sql, code: rc, message: message)
        }
    }

    // MARK: - Column (0-indexed)

    func int64(at column: Int32) -> Int64 {
        guard let stmt = stmt else { return 0 }
        return sqlite3_column_int64(stmt, column)
    }

    func int(at column: Int32) -> Int {
        Int(int64(at: column))
    }

    func bool(at column: Int32) -> Bool {
        int64(at: column) != 0
    }

    func string(at column: Int32) -> String? {
        guard let stmt = stmt, let cString = sqlite3_column_text(stmt, column) else { return nil }
        return String(cString: cString)
    }

    func requiredString(at column: Int32, name: String) throws -> String {
        guard let value = string(at: column) else {
            throw SQLiteError.unexpectedNullColumn(name: name)
        }
        return value
    }
}
