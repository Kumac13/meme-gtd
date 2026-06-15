import Foundation
import SQLite3

/// Errors surfaced by the lightweight SQLite wrapper. Thin layer so call sites
/// can pattern-match on cause (open failed, statement prepare failed, etc.)
/// rather than reading raw integer return codes.
enum SQLiteError: Error, LocalizedError {
    case open(path: String, code: Int32, message: String)
    case prepare(sql: String, code: Int32, message: String)
    case step(sql: String, code: Int32, message: String)
    case bind(sql: String, code: Int32, message: String)
    case unexpectedNullColumn(name: String)
    case migration(version: Int, code: Int32, message: String)

    var errorDescription: String? {
        switch self {
        case .open(let path, let code, let message):
            return "SQLite open(\(path)) failed [\(code)]: \(message)"
        case .prepare(let sql, let code, let message):
            return "SQLite prepare failed [\(code)] for \(sql.prefix(120)): \(message)"
        case .step(let sql, let code, let message):
            return "SQLite step failed [\(code)] for \(sql.prefix(120)): \(message)"
        case .bind(let sql, let code, let message):
            return "SQLite bind failed [\(code)] for \(sql.prefix(120)): \(message)"
        case .unexpectedNullColumn(let name):
            return "SQLite column '\(name)' was NULL but a non-null value was expected"
        case .migration(let version, let code, let message):
            return "SQLite migration v\(version) failed [\(code)]: \(message)"
        }
    }

    /// Whether the underlying code is `SQLITE_CONSTRAINT_UNIQUE`, used by the
    /// outbox to detect that a retry hit the partial UNIQUE index on client_id.
    var isUniqueConstraintViolation: Bool {
        switch self {
        case .step(_, let code, _), .bind(_, let code, _):
            return code == SQLITE_CONSTRAINT || code == 2067 // SQLITE_CONSTRAINT_UNIQUE
        default:
            return false
        }
    }
}
