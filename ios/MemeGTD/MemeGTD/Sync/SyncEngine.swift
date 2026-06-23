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

    /// Subscribe to NetworkMonitor so we kick a pull whenever connectivity
    /// returns. Safe to call multiple times.
    func bindToNetworkMonitor(_ monitor: NetworkMonitor) {
        monitor.didComeOnline
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                Task { @MainActor in
                    await self?.pullMemos()
                }
            }
            .store(in: &cancellables)
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
