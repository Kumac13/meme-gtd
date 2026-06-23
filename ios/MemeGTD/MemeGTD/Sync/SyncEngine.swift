import Foundation
import SwiftData
import Combine
import os

private let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "SyncEngine")

/// Coordinates server <-> local SwiftData sync for memos and their comments.
///
/// Phase 1 (this build): pull-only — fetch from the API and reconcile into
/// the local cache. Push (Outbox flush) lands in the next PR.
@MainActor
final class SyncEngine: ObservableObject {
    static let shared = SyncEngine()

    /// Set to true while a pull is in flight so the UI can show a "syncing"
    /// indicator. Multiple concurrent callers are coalesced (see `pull`).
    @Published private(set) var isSyncing: Bool = false

    /// Timestamp of the most recent successful pull. Used by the UI to show
    /// a "last synced" hint.
    @Published private(set) var lastSyncedAt: Date?

    /// True once an initial full hydration has completed for the current
    /// schema version. Persisted in UserDefaults via AppDatabase.hydrationFlagKey.
    @Published private(set) var didHydrate: Bool

    /// Fires after every successful pull or push so observers (MemoStore)
    /// can refresh their in-memory copy of the cache.
    let didFinishSyncStep = PassthroughSubject<Void, Never>()

    private var context: ModelContext?
    private var inFlight: Task<Void, Never>?
    private var cancellables: Set<AnyCancellable> = []

    private init() {
        self.didHydrate = UserDefaults.standard.bool(forKey: AppDatabase.hydrationFlagKey)
    }

    /// Inject the SwiftData context. Called once from MemeGTDApp's first
    /// `.task` after the ModelContainer is available on the main actor.
    func attach(context: ModelContext) {
        self.context = context
    }

    /// Subscribe to NetworkMonitor so we flush the Outbox and pull whenever
    /// connectivity returns. Safe to call multiple times.
    func bindToNetworkMonitor(_ monitor: NetworkMonitor) {
        monitor.didComeOnline
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                Task { @MainActor in
                    await self?.pushOutbox()
                    await self?.pullMemos()
                }
            }
            .store(in: &cancellables)
    }

    /// True when there are queued operations waiting to be sent. UI uses this
    /// to show a "Offline · N pending" badge.
    func pendingOperationCount() -> Int {
        guard let context else { return 0 }
        return OutboxRepository(context: context).count
    }

    /// Kick off a non-blocking push of the Outbox. Safe to call from any UI
    /// handler — it returns immediately and pushes in the background.
    func kick() {
        Task { @MainActor in
            await self.pushOutbox()
        }
    }

    // MARK: - Memo pull

    /// Fetches the most recent page of memos and reconciles them into the
    /// local cache. Coalesces concurrent calls — if a pull is already
    /// running, the new caller awaits the in-flight result.
    func pullMemos(limit: Int = 100) async {
        if let existing = inFlight {
            await existing.value
            return
        }
        let task = Task { @MainActor in
            await self.runPull(limit: limit, fullHydration: false)
        }
        inFlight = task
        await task.value
        inFlight = nil
    }

    /// First-launch full pull: paginates through every memo so the user can
    /// browse offline. Sets the hydration flag on success.
    func runInitialHydration(pageSize: Int = 100) async {
        guard !didHydrate else { return }
        if let existing = inFlight {
            await existing.value
            return
        }
        let task = Task { @MainActor in
            await self.runPull(limit: pageSize, fullHydration: true)
        }
        inFlight = task
        await task.value
        inFlight = nil
    }

    private func runPull(limit: Int, fullHydration: Bool) async {
        guard let context else {
            logger.warning("runPull skipped — no context attached")
            return
        }
        isSyncing = true
        defer { isSyncing = false }

        let repo = LocalMemoRepository(context: context)
        var offset = 0
        var seenIds: Set<Int> = []

        do {
            while true {
                let items: [URLQueryItem] = [
                    URLQueryItem(name: "limit", value: String(limit)),
                    URLQueryItem(name: "offset", value: String(offset)),
                    URLQueryItem(name: "order", value: "desc"),
                ]
                let response: MemoListResponse = try await APIClient.shared.get(
                    path: "/api/memos",
                    queryItems: items
                )
                for memo in response.data {
                    repo.upsertFromServer(memo)
                    seenIds.insert(memo.id)
                }
                try repo.save()

                if !fullHydration { break }
                offset += response.data.count
                if response.data.isEmpty || offset >= response.total {
                    break
                }
            }

            if fullHydration {
                _ = repo.pruneMemosNotIn(remoteIds: seenIds)
                try repo.save()
                UserDefaults.standard.set(true, forKey: AppDatabase.hydrationFlagKey)
                didHydrate = true
            }

            lastSyncedAt = Date()
            logger.info("pullMemos done: synced=\(seenIds.count) fullHydration=\(fullHydration)")
        } catch {
            logger.error("pullMemos failed: \(error.localizedDescription)")
            // Pull failures are non-fatal: the UI will simply keep showing
            // the cached data. We do NOT clear lastSyncedAt.
        }
        didFinishSyncStep.send(())
    }

    // MARK: - Outbox push

    /// Drain the Outbox against the server. Stops at the first network
    /// failure; subsequent calls (after reconnect) pick up where this left
    /// off. Each op is sent in its enqueue order to preserve causality —
    /// a `createComment` only fires once its parent memo's `createMemo`
    /// has resolved and obtained a `remoteId`.
    func pushOutbox() async {
        guard let context else { return }
        let outbox = OutboxRepository(context: context)
        let memos = LocalMemoRepository(context: context)

        let ops = outbox.pendingOperations()
        for op in ops {
            do {
                switch op.kind {
                case .createMemo:
                    try await pushCreateMemo(op: op, memos: memos)
                case .updateMemo:
                    try await pushUpdateMemo(op: op, memos: memos)
                case .deleteMemo:
                    try await pushDeleteMemo(op: op, memos: memos)
                case .createComment:
                    try await pushCreateComment(op: op, memos: memos)
                case .updateComment:
                    try await pushUpdateComment(op: op, memos: memos)
                case .deleteComment:
                    try await pushDeleteComment(op: op, memos: memos)
                }
                outbox.delete(op)
                try? memos.save()
            } catch SyncEngineError.parentNotYetSynced {
                // Parent memo has not been created yet — stop the loop;
                // the parent op earlier in the queue will be retried first.
                logger.info("pushOutbox stalled: parent not synced for op \(op.id)")
                return
            } catch SyncEngineError.parentGoneFromServer {
                // Server-side delete invalidated this op. Mark the parent as
                // conflict and drop the op so the queue can proceed.
                if let local = memos.fetchMemo(byLocalId: op.memoLocalId) {
                    local.syncState = .conflict
                    local.lastSyncError = "Memo was deleted on the server"
                }
                outbox.delete(op)
                try? memos.save()
            } catch {
                outbox.recordFailure(op, message: error.localizedDescription)
                if let local = memos.fetchMemo(byLocalId: op.memoLocalId) {
                    local.lastSyncError = error.localizedDescription
                }
                try? memos.save()
                logger.warning("pushOutbox error on op \(op.id): \(error.localizedDescription)")
                // Stop on first failure: connectivity is likely down, and
                // retrying every op now would just produce N identical
                // errors. NetworkMonitor will kick us again on recovery.
                didFinishSyncStep.send(())
                return
            }
        }
        didFinishSyncStep.send(())
    }

    private func pushCreateMemo(op: OutboxOperation, memos: LocalMemoRepository) async throws {
        guard let local = memos.fetchMemo(byLocalId: op.memoLocalId) else { return }
        let body = OutboxRepository.decodeBody(op.payloadJson) ?? local.bodyMd
        let request = CreateMemoRequest(bodyMd: body, clientUuid: op.clientUuid)
        let server: Memo = try await APIClient.shared.post(path: "/api/memos", body: request)
        applyServerCreate(local: local, server: server)
    }

    private func pushUpdateMemo(op: OutboxOperation, memos: LocalMemoRepository) async throws {
        guard let local = memos.fetchMemo(byLocalId: op.memoLocalId) else { return }
        guard let remoteId = local.remoteId else {
            throw SyncEngineError.parentNotYetSynced
        }
        let body = OutboxRepository.decodeBody(op.payloadJson) ?? local.bodyMd
        do {
            let server: Memo = try await APIClient.shared.patch(
                path: "/api/memos/\(remoteId)",
                body: UpdateMemoRequest(bodyMd: body, isBookmarked: nil)
            )
            applyServerUpdate(local: local, server: server)
        } catch let APIError.serverError(code, _) where code == 404 {
            throw SyncEngineError.parentGoneFromServer
        }
    }

    private func pushDeleteMemo(op: OutboxOperation, memos: LocalMemoRepository) async throws {
        guard let local = memos.fetchMemo(byLocalId: op.memoLocalId) else { return }
        if let remoteId = local.remoteId {
            do {
                try await APIClient.shared.delete(path: "/api/memos/\(remoteId)")
            } catch let APIError.serverError(code, _) where code == 404 {
                // Already gone — proceed with local cleanup.
            }
        }
        if let context = self.context {
            context.delete(local)
        }
    }

    private func pushCreateComment(op: OutboxOperation, memos: LocalMemoRepository) async throws {
        guard let memo = memos.fetchMemo(byLocalId: op.memoLocalId) else { return }
        guard let remoteId = memo.remoteId else {
            throw SyncEngineError.parentNotYetSynced
        }
        guard let commentLocalId = op.commentLocalId,
              let local = fetchLocalComment(memos: memos, localId: commentLocalId) else { return }
        let body = OutboxRepository.decodeBody(op.payloadJson) ?? local.bodyMd
        let request = CreateCommentRequest(bodyMd: body, clientUuid: op.clientUuid)
        do {
            let server: Comment = try await APIClient.shared.post(
                path: "/api/memos/\(remoteId)/comments",
                body: request
            )
            applyServerCreate(localComment: local, server: server)
        } catch let APIError.serverError(code, _) where code == 404 {
            throw SyncEngineError.parentGoneFromServer
        }
    }

    private func pushUpdateComment(op: OutboxOperation, memos: LocalMemoRepository) async throws {
        guard let memo = memos.fetchMemo(byLocalId: op.memoLocalId),
              let memoRemoteId = memo.remoteId else {
            throw SyncEngineError.parentNotYetSynced
        }
        guard let commentLocalId = op.commentLocalId,
              let local = fetchLocalComment(memos: memos, localId: commentLocalId),
              let commentRemoteId = local.remoteId else {
            throw SyncEngineError.parentNotYetSynced
        }
        let body = OutboxRepository.decodeBody(op.payloadJson) ?? local.bodyMd
        do {
            let server: Comment = try await APIClient.shared.patch(
                path: "/api/memos/\(memoRemoteId)/comments/\(commentRemoteId)",
                body: UpdateCommentRequest(bodyMd: body)
            )
            applyServerUpdate(localComment: local, server: server)
        } catch let APIError.serverError(code, _) where code == 404 {
            throw SyncEngineError.parentGoneFromServer
        }
    }

    private func pushDeleteComment(op: OutboxOperation, memos: LocalMemoRepository) async throws {
        guard let memo = memos.fetchMemo(byLocalId: op.memoLocalId),
              let memoRemoteId = memo.remoteId else {
            throw SyncEngineError.parentNotYetSynced
        }
        guard let commentLocalId = op.commentLocalId,
              let local = fetchLocalComment(memos: memos, localId: commentLocalId) else { return }
        if let commentRemoteId = local.remoteId {
            do {
                try await APIClient.shared.delete(
                    path: "/api/memos/\(memoRemoteId)/comments/\(commentRemoteId)"
                )
            } catch let APIError.serverError(code, _) where code == 404 {
                // Already gone — fall through to local cleanup.
            }
        }
        if let context = self.context {
            context.delete(local)
        }
    }

    private func applyServerCreate(local: LocalMemo, server: Memo) {
        local.remoteId = server.id
        local.bodyMd = server.bodyMd
        local.isBookmarked = server.isBookmarked
        local.isDeleted = server.isDeleted
        local.commentCount = server.commentCount ?? local.commentCount
        local.labels = server.labels ?? local.labels
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        local.serverCreatedAt = formatter.date(from: server.createdAt) ?? Date()
        local.serverUpdatedAt = formatter.date(from: server.updatedAt) ?? Date()
        local.syncState = .synced
        local.lastSyncError = nil
    }

    private func applyServerUpdate(local: LocalMemo, server: Memo) {
        local.bodyMd = server.bodyMd
        local.isBookmarked = server.isBookmarked
        local.labels = server.labels ?? local.labels
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        local.serverUpdatedAt = formatter.date(from: server.updatedAt) ?? Date()
        local.syncState = .synced
        local.lastSyncError = nil
    }

    private func applyServerCreate(localComment: LocalComment, server: Comment) {
        localComment.remoteId = server.id
        localComment.bodyMd = server.bodyMd
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        localComment.serverCreatedAt = formatter.date(from: server.createdAt) ?? Date()
        localComment.serverUpdatedAt = formatter.date(from: server.updatedAt) ?? Date()
        localComment.syncState = .synced
        localComment.lastSyncError = nil
    }

    private func applyServerUpdate(localComment: LocalComment, server: Comment) {
        localComment.bodyMd = server.bodyMd
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        localComment.serverUpdatedAt = formatter.date(from: server.updatedAt) ?? Date()
        localComment.syncState = .synced
        localComment.lastSyncError = nil
    }

    private func fetchLocalComment(memos: LocalMemoRepository, localId: UUID) -> LocalComment? {
        guard let context = self.context else { return nil }
        let descriptor = FetchDescriptor<LocalComment>(
            predicate: #Predicate { $0.localId == localId }
        )
        return (try? context.fetch(descriptor))?.first
    }

    enum SyncEngineError: Error {
        case parentNotYetSynced
        case parentGoneFromServer
    }

    // MARK: - Comments pull (per-memo, on demand)

    /// Pull the comments of a single memo into the cache. Called by the
    /// detail view to keep the thread offline-readable.
    func pullComments(forMemoRemoteId remoteId: Int) async {
        guard let context else { return }
        let repo = LocalMemoRepository(context: context)
        guard let local = repo.fetchMemo(byRemoteId: remoteId) else { return }

        do {
            let comments: [Comment] = try await APIClient.shared.get(
                path: "/api/memos/\(remoteId)/comments"
            )
            repo.replaceComments(comments, for: local)
            try repo.save()
        } catch {
            logger.warning("pullComments(\(remoteId)) failed: \(error.localizedDescription)")
        }
    }
}
