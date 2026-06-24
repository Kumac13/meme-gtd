import Foundation
import SwiftData

/// Thin CRUD wrapper over the SwiftData store for memos and their comments.
/// Lives on the main actor so it can be called from `@MainActor` Stores and
/// ViewModels without trampolining.
@MainActor
struct LocalMemoRepository {
    let context: ModelContext

    // MARK: - Memo queries

    /// All non-deleted memos in newest-first order. Used for the list view.
    func fetchMemos() -> [LocalMemo] {
        var descriptor = FetchDescriptor<LocalMemo>(
            predicate: #Predicate { !$0.isDeleted },
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )
        descriptor.fetchLimit = 500 // safety cap; UI only renders so much
        return (try? context.fetch(descriptor)) ?? []
    }

    func fetchMemo(byRemoteId remoteId: Int) -> LocalMemo? {
        let descriptor = FetchDescriptor<LocalMemo>(
            predicate: #Predicate { $0.remoteId == remoteId && !$0.isDeleted }
        )
        return (try? context.fetch(descriptor))?.first
    }

    func fetchMemo(byLocalId localId: UUID) -> LocalMemo? {
        let descriptor = FetchDescriptor<LocalMemo>(
            predicate: #Predicate { $0.localId == localId }
        )
        return (try? context.fetch(descriptor))?.first
    }

    func fetchMemo(byClientUuid clientUuid: String) -> LocalMemo? {
        let descriptor = FetchDescriptor<LocalMemo>(
            predicate: #Predicate { $0.clientUuid == clientUuid }
        )
        return (try? context.fetch(descriptor))?.first
    }

    /// Look up a memo using whatever ID the UI happens to hold. Positive
    /// values address rows that already exist on the server; negative values
    /// are the stable IDs we synthesize for pending-create rows. The
    /// negative path scans up to 500 rows — fine for personal-app scale.
    func fetchMemo(byAnyId id: Int) -> LocalMemo? {
        if id > 0 {
            return fetchMemo(byRemoteId: id)
        }
        for local in fetchMemos() where local.localId.stableLocalId == id {
            return local
        }
        return nil
    }

    /// Same as `fetchMemo(byAnyId:)` but for comments.
    func fetchComment(byAnyId id: Int, in memo: LocalMemo) -> LocalComment? {
        if id > 0 {
            return fetchComment(byRemoteId: id)
        }
        for c in fetchComments(forMemo: memo) where c.localId.stableLocalId == id {
            return c
        }
        return nil
    }

    /// Lookup a comment by its `localId` directly. Used when an Outbox op
    /// holds the comment's UUID but we have no surrounding memo handle.
    func fetchComment(byAnyLocalId localId: UUID) -> LocalComment? {
        let descriptor = FetchDescriptor<LocalComment>(
            predicate: #Predicate { $0.localId == localId }
        )
        return (try? context.fetch(descriptor))?.first
    }

    var memoCount: Int {
        (try? context.fetchCount(FetchDescriptor<LocalMemo>(
            predicate: #Predicate { !$0.isDeleted }
        ))) ?? 0
    }

    // MARK: - Memo writes

    /// Upserts a server-fetched memo into the cache. The local row is marked
    /// `.synced` and all server timestamps / labels / commentCount are
    /// authoritative. Returns the (possibly new) LocalMemo.
    @discardableResult
    func upsertFromServer(_ memo: Memo) -> LocalMemo {
        if let existing = fetchMemo(byRemoteId: memo.id) {
            applyServerFields(to: existing, from: memo)
            return existing
        }
        let local = LocalMemo(
            remoteId: memo.id,
            clientUuid: UUID().uuidString.lowercased(),
            bodyMd: memo.bodyMd,
            isBookmarked: memo.isBookmarked,
            isDeleted: memo.isDeleted,
            createdAt: parseDate(memo.createdAt) ?? Date(),
            updatedAt: parseDate(memo.updatedAt) ?? Date(),
            serverCreatedAt: parseDate(memo.createdAt),
            serverUpdatedAt: parseDate(memo.updatedAt),
            labelsJson: encodeLabels(memo.labels ?? []),
            commentCount: memo.commentCount ?? 0,
            syncState: .synced
        )
        context.insert(local)
        return local
    }

    /// Mark memos that are no longer present on the server as locally deleted
    /// (only those whose `syncState` is `.synced` — pending local edits are
    /// preserved). Returns the number of rows pruned.
    @discardableResult
    func pruneMemosNotIn(remoteIds: Set<Int>) -> Int {
        let descriptor = FetchDescriptor<LocalMemo>(
            predicate: #Predicate { $0.remoteId != nil && !$0.isDeleted }
        )
        guard let all = try? context.fetch(descriptor) else { return 0 }
        var pruned = 0
        for local in all where local.syncState == .synced {
            if let rid = local.remoteId, !remoteIds.contains(rid) {
                context.delete(local)
                pruned += 1
            }
        }
        return pruned
    }

    // MARK: - Comment queries

    func fetchComments(forMemo memo: LocalMemo) -> [LocalComment] {
        let memoId = memo.localId
        var descriptor = FetchDescriptor<LocalComment>(
            predicate: #Predicate { $0.memo?.localId == memoId && !$0.isDeleted },
            sortBy: [SortDescriptor(\.createdAt, order: .forward)]
        )
        descriptor.fetchLimit = 1_000
        return (try? context.fetch(descriptor)) ?? []
    }

    func fetchComment(byRemoteId remoteId: Int) -> LocalComment? {
        let descriptor = FetchDescriptor<LocalComment>(
            predicate: #Predicate { $0.remoteId == remoteId }
        )
        return (try? context.fetch(descriptor))?.first
    }

    // MARK: - Comment writes

    @discardableResult
    func upsertFromServer(_ comment: Comment, memo: LocalMemo) -> LocalComment {
        if let existing = fetchComment(byRemoteId: comment.id) {
            existing.bodyMd = comment.bodyMd
            existing.serverCreatedAt = parseDate(comment.createdAt)
            existing.serverUpdatedAt = parseDate(comment.updatedAt)
            existing.updatedAt = parseDate(comment.updatedAt) ?? existing.updatedAt
            existing.createdAt = parseDate(comment.createdAt) ?? existing.createdAt
            existing.isDeleted = false
            existing.syncState = .synced
            existing.lastSyncError = nil
            if existing.memo == nil { existing.memo = memo }
            return existing
        }
        let local = LocalComment(
            remoteId: comment.id,
            clientUuid: UUID().uuidString.lowercased(),
            bodyMd: comment.bodyMd,
            createdAt: parseDate(comment.createdAt) ?? Date(),
            updatedAt: parseDate(comment.updatedAt) ?? Date(),
            serverCreatedAt: parseDate(comment.createdAt),
            serverUpdatedAt: parseDate(comment.updatedAt),
            isDeleted: false,
            syncState: .synced,
            memo: memo
        )
        context.insert(local)
        return local
    }

    /// Replace the cached comments for a memo with the supplied server set.
    /// Synced rows not in the new set are removed; pending rows are kept.
    func replaceComments(_ serverComments: [Comment], for memo: LocalMemo) {
        let serverIds = Set(serverComments.map { $0.id })
        for existing in fetchComments(forMemo: memo) where existing.syncState == .synced {
            if let rid = existing.remoteId, !serverIds.contains(rid) {
                context.delete(existing)
            }
        }
        for comment in serverComments {
            _ = upsertFromServer(comment, memo: memo)
        }
        memo.commentCount = serverComments.count
    }

    // MARK: - Save

    /// Persist all queued changes. Throws if SwiftData rejects the write —
    /// callers may surface the error to the user or log and drop it.
    func save() throws {
        if context.hasChanges {
            try context.save()
        }
    }

    // MARK: - Helpers

    private func applyServerFields(to local: LocalMemo, from memo: Memo) {
        // Respect locally-pending edits: only overwrite synced rows.
        guard local.syncState == .synced else { return }
        local.bodyMd = memo.bodyMd
        local.isBookmarked = memo.isBookmarked
        local.isDeleted = memo.isDeleted
        if let serverUpdated = parseDate(memo.updatedAt) {
            local.serverUpdatedAt = serverUpdated
            local.updatedAt = serverUpdated
        }
        if let serverCreated = parseDate(memo.createdAt) {
            local.serverCreatedAt = serverCreated
            local.createdAt = serverCreated
        }
        local.labelsJson = encodeLabels(memo.labels ?? [])
        local.commentCount = memo.commentCount ?? local.commentCount
        local.lastSyncError = nil
    }

    private func encodeLabels(_ labels: [String]) -> String {
        let data = (try? JSONEncoder().encode(labels)) ?? Data("[]".utf8)
        return String(data: data, encoding: .utf8) ?? "[]"
    }

    private func parseDate(_ string: String) -> Date? {
        LocalMemoRepository.iso8601Parsers.first(where: { $0.date(from: string) != nil })?.date(from: string)
    }

    /// Cached ISO-8601 parsers — the API emits both "...Z" and "...000Z" forms
    /// depending on whether the timestamp has fractional seconds.
    private static let iso8601Parsers: [ISO8601DateFormatter] = {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return [withFraction, plain]
    }()
}
