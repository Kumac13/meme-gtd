import Foundation
import SwiftData

/// CRUD over the OutboxOperation queue. The queue is shared between
/// MemoListViewModel / MemoDetailViewModel (which enqueue ops on local
/// mutations) and SyncEngine (which drains the queue against the server).
///
/// Ordering: ops execute oldest-first by `enqueuedAt`. The repository also
/// applies a few invariants when enqueueing so the queue stays compact:
///
/// - `createMemo + deleteMemo` for the same `memoLocalId` cancel each other
///   out: both ops are removed and the LocalMemo is physically deleted
///   (the server never hears about it). The user's create+delete during a
///   single offline session is a no-op as far as the server is concerned.
/// - Multiple `updateMemo` for the same `memoLocalId` collapse into the
///   latest payload, so the server eventually receives one PATCH, not N.
@MainActor
struct OutboxRepository {
    let context: ModelContext

    // MARK: - Fetch

    /// Returns all queued operations in execution order.
    func pendingOperations() -> [OutboxOperation] {
        let descriptor = FetchDescriptor<OutboxOperation>(
            sortBy: [SortDescriptor(\.enqueuedAt, order: .forward)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    /// Number of queued operations. Cheap — used for UI badges.
    var count: Int {
        (try? context.fetchCount(FetchDescriptor<OutboxOperation>())) ?? 0
    }

    /// Operations affecting a specific memo. Used by the merge logic.
    func operations(forMemo memoLocalId: UUID) -> [OutboxOperation] {
        let descriptor = FetchDescriptor<OutboxOperation>(
            predicate: #Predicate { $0.memoLocalId == memoLocalId },
            sortBy: [SortDescriptor(\.enqueuedAt, order: .forward)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    // MARK: - Enqueue (with merge)

    /// Enqueue a memo create. Always inserts a fresh row — duplicates do not
    /// happen here because the caller has just created the LocalMemo.
    func enqueueCreateMemo(memoLocalId: UUID, clientUuid: String, bodyMd: String, at date: Date) {
        let payload = ["bodyMd": bodyMd]
        let op = OutboxOperation(
            kind: .createMemo,
            targetType: "memo",
            memoLocalId: memoLocalId,
            payloadJson: encode(payload),
            clientUuid: clientUuid,
            enqueuedAt: date
        )
        context.insert(op)
    }

    /// Enqueue a memo update. If there is already a pending `createMemo` for
    /// the same memo, fold the new body into its payload so the eventual
    /// POST already carries the latest body and we don't need a separate
    /// PATCH. If there is an earlier `updateMemo`, overwrite it with the
    /// latest payload so we send only one PATCH.
    func enqueueUpdateMemo(memoLocalId: UUID, bodyMd: String, at date: Date) {
        let ops = operations(forMemo: memoLocalId)
        if let create = ops.first(where: { $0.kind == .createMemo }) {
            create.payloadJson = encode(["bodyMd": bodyMd])
            return
        }
        if let existingUpdate = ops.last(where: { $0.kind == .updateMemo }) {
            existingUpdate.payloadJson = encode(["bodyMd": bodyMd])
            existingUpdate.enqueuedAt = date
            existingUpdate.retryCount = 0
            existingUpdate.lastError = nil
            return
        }
        let op = OutboxOperation(
            kind: .updateMemo,
            targetType: "memo",
            memoLocalId: memoLocalId,
            payloadJson: encode(["bodyMd": bodyMd]),
            clientUuid: UUID().lowercasedString,
            enqueuedAt: date
        )
        context.insert(op)
    }

    /// Enqueue a memo delete. Cancels any pending create/update for the
    /// same memo. Returns `true` when create + delete fully cancelled
    /// (caller should physically remove the LocalMemo and skip the DELETE
    /// HTTP call entirely).
    @discardableResult
    func enqueueDeleteMemo(memoLocalId: UUID, at date: Date) -> Bool {
        let ops = operations(forMemo: memoLocalId)
        let hadCreate = ops.contains { $0.kind == .createMemo }
        for op in ops {
            context.delete(op)
        }
        if hadCreate {
            return true
        }
        let op = OutboxOperation(
            kind: .deleteMemo,
            targetType: "memo",
            memoLocalId: memoLocalId,
            payloadJson: "{}",
            clientUuid: UUID().lowercasedString,
            enqueuedAt: date
        )
        context.insert(op)
        return false
    }

    func enqueueCreateComment(memoLocalId: UUID, commentLocalId: UUID, clientUuid: String, bodyMd: String, at date: Date) {
        let op = OutboxOperation(
            kind: .createComment,
            targetType: "comment",
            memoLocalId: memoLocalId,
            commentLocalId: commentLocalId,
            payloadJson: encode(["bodyMd": bodyMd]),
            clientUuid: clientUuid,
            enqueuedAt: date
        )
        context.insert(op)
    }

    func enqueueUpdateComment(memoLocalId: UUID, commentLocalId: UUID, bodyMd: String, at date: Date) {
        let descriptor = FetchDescriptor<OutboxOperation>(
            predicate: #Predicate { $0.commentLocalId == commentLocalId }
        )
        let existing = (try? context.fetch(descriptor)) ?? []
        if let create = existing.first(where: { $0.kind == .createComment }) {
            create.payloadJson = encode(["bodyMd": bodyMd])
            return
        }
        if let upd = existing.last(where: { $0.kind == .updateComment }) {
            upd.payloadJson = encode(["bodyMd": bodyMd])
            upd.enqueuedAt = date
            upd.retryCount = 0
            upd.lastError = nil
            return
        }
        let op = OutboxOperation(
            kind: .updateComment,
            targetType: "comment",
            memoLocalId: memoLocalId,
            commentLocalId: commentLocalId,
            payloadJson: encode(["bodyMd": bodyMd]),
            clientUuid: UUID().lowercasedString,
            enqueuedAt: date
        )
        context.insert(op)
    }

    @discardableResult
    func enqueueDeleteComment(memoLocalId: UUID, commentLocalId: UUID, at date: Date) -> Bool {
        let descriptor = FetchDescriptor<OutboxOperation>(
            predicate: #Predicate { $0.commentLocalId == commentLocalId }
        )
        let existing = (try? context.fetch(descriptor)) ?? []
        let hadCreate = existing.contains { $0.kind == .createComment }
        for op in existing {
            context.delete(op)
        }
        if hadCreate {
            return true
        }
        let op = OutboxOperation(
            kind: .deleteComment,
            targetType: "comment",
            memoLocalId: memoLocalId,
            commentLocalId: commentLocalId,
            payloadJson: "{}",
            clientUuid: UUID().lowercasedString,
            enqueuedAt: date
        )
        context.insert(op)
        return false
    }

    // MARK: - Mutation

    func delete(_ op: OutboxOperation) {
        context.delete(op)
    }

    func recordFailure(_ op: OutboxOperation, message: String) {
        op.retryCount += 1
        op.lastError = message
        op.lastTriedAt = Date()
    }

    /// Drop an op from the queue without sending. Also rolls the LocalMemo /
    /// LocalComment back to a sane terminal state where possible: a
    /// pendingCreate row is removed (it was never on the server), a
    /// pendingUpdate / pendingDelete row is reset to `.synced` so the cache
    /// matches the server's last known good state. Used by the user-facing
    /// "Discard" action in OutboxStatusSheet.
    func discard(_ op: OutboxOperation, memos: LocalMemoRepository) {
        switch op.kind {
        case .createMemo:
            if let local = memos.fetchMemo(byLocalId: op.memoLocalId) {
                context.delete(local)
            }
        case .updateMemo, .deleteMemo:
            if let local = memos.fetchMemo(byLocalId: op.memoLocalId) {
                local.syncState = local.remoteId != nil ? .synced : .pendingCreate
                local.lastSyncError = nil
                if op.kind == .deleteMemo {
                    local.isDeleted = false
                }
            }
        case .createComment:
            if let commentId = op.commentLocalId,
               let local = memos.fetchComment(byAnyLocalId: commentId) {
                context.delete(local)
            }
        case .updateComment, .deleteComment:
            if let commentId = op.commentLocalId,
               let local = memos.fetchComment(byAnyLocalId: commentId) {
                local.syncState = local.remoteId != nil ? .synced : .pendingCreate
                local.lastSyncError = nil
                if op.kind == .deleteComment {
                    local.isDeleted = false
                }
            }
        }
        context.delete(op)
    }

    // MARK: - Helpers

    private func encode<T: Encodable>(_ value: T) -> String {
        let data = (try? JSONEncoder().encode(value)) ?? Data("{}".utf8)
        return String(data: data, encoding: .utf8) ?? "{}"
    }

    static func decodeBody(_ json: String) -> String? {
        guard let data = json.data(using: .utf8) else { return nil }
        return (try? JSONDecoder().decode([String: String].self, from: data))?["bodyMd"]
    }
}
