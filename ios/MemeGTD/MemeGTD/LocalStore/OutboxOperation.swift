import Foundation

/// One pending mutation that needs to reach the server. v1 only carries
/// `memo.create` ops, but the schema is general enough that future Type A
/// work (memo edits, task creates, etc.) can add op_types without altering
/// the table.
struct OutboxOperation: Equatable {
    enum State: String {
        case pending
        case syncing
        case failed
    }

    enum OpType: String {
        case memoCreate = "memo.create"
    }

    let id: String                  // ULID — distinct from target_id so we
                                    // could in principle queue multiple ops
                                    // against the same local_memos row.
    let opType: OpType
    let targetId: String            // local_memos.id (ULID)
    let payload: Data               // JSON-encoded
    var state: State
    var attempts: Int
    var lastError: String?
    let createdAt: Date
    var nextRetryAt: Date?
}
