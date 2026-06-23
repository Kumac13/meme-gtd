import Foundation

/// Kind of operation queued for offline send.
///
/// The string raw value is stable on disk so it must NOT be renamed without a
/// SwiftData migration.
enum OutboxKindRaw: String, Codable, CaseIterable {
    case createMemo
    case updateMemo
    case deleteMemo
    case createComment
    case updateComment
    case deleteComment
}
