import Combine
import Foundation
import UIKit
import os

/// Single source of truth for "is iOS allowed to talk to the server right
/// now, and if so are there pending writes to send?". The engine is a
/// long-lived `@MainActor` object that listens to network changes and app
/// lifecycle, then drains the outbox one op at a time.
///
/// Read-only cache refresh (server -> local_*) is handled in a later
/// sub-PR; v1 of the engine only does the write direction (local -> server).
@MainActor
final class SyncEngine: ObservableObject {
    static let shared = SyncEngine()

    @Published private(set) var isOnline: Bool = false
    @Published private(set) var isSyncing: Bool = false
    @Published private(set) var failedCount: Int = 0
    @Published private(set) var lastSyncCompletedAt: Date?

    private static let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "SyncEngine")
    private static let maxAttempts = 10
    private static let baseBackoff: TimeInterval = 1
    private static let maxBackoff: TimeInterval = 300 // 5 minutes
    private static let healthRecheckInterval: TimeInterval = 60

    private let outbox: OutboxRepository
    private let memos: LocalMemoRepository
    private let api: APIClient
    private var cancellables: Set<AnyCancellable> = []
    private var syncTask: Task<Void, Never>?
    private var lastHealthCheckAt: Date?

    /// Default init that wires up the production singletons. Tests can use
    /// `init(outbox:memos:api:)` (below) to inject fakes.
    init() {
        self.outbox = OutboxRepository()
        self.memos = LocalMemoRepository()
        self.api = .shared
    }

    init(outbox: OutboxRepository, memos: LocalMemoRepository, api: APIClient) {
        self.outbox = outbox
        self.memos = memos
        self.api = api
    }

    /// Called once from MemeGTDApp at launch. Hooks up the path monitor and
    /// foreground/background notifications, then kicks an initial sync so
    /// anything left in the outbox from a previous session moves quickly.
    func bootstrap() {
        NetworkMonitor.shared.$hasPath
            .removeDuplicates()
            .sink { [weak self] hasPath in
                Task { @MainActor in
                    await self?.handlePathChange(hasPath: hasPath)
                }
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)
            .sink { [weak self] _ in
                Task { @MainActor in
                    self?.requestSync(reason: "foreground")
                }
            }
            .store(in: &cancellables)

        refreshFailedCount()
        requestSync(reason: "bootstrap")
    }

    /// Public entry point — debounces to a single in-flight sync task.
    /// Trigger reasons are logged so we can tell from Console why the engine
    /// woke up in case sync latency ever needs debugging.
    func requestSync(reason: String) {
        guard syncTask == nil else {
            Self.logger.debug("sync already in flight, dropping trigger from \(reason)")
            return
        }
        Self.logger.info("sync trigger: \(reason)")
        syncTask = Task { @MainActor [weak self] in
            await self?.drain()
            self?.syncTask = nil
        }
    }

    /// User-initiated retry from FailedMemosView. Resets backoff state so
    /// the failed op is eligible immediately, then runs the drain.
    func retryFailed(operationId: String) async {
        do {
            try outbox.resetForManualRetry(id: operationId)
            refreshFailedCount()
        } catch {
            Self.logger.error("manual retry reset failed: \(error.localizedDescription)")
        }
        requestSync(reason: "manual-retry")
    }

    private func handlePathChange(hasPath: Bool) async {
        if hasPath {
            requestSync(reason: "network-restored")
        } else {
            // Path lost — flip online to false immediately so the UI can
            // disable edit affordances without waiting for a probe.
            isOnline = false
        }
    }

    /// Core loop: confirm we're online, fetch due ops, send each, retire
    /// or schedule retry. We stop the loop as soon as we go offline mid-run
    /// because more attempts are guaranteed to fail.
    private func drain() async {
        isSyncing = true
        defer { isSyncing = false }

        guard NetworkMonitor.shared.hasPath else {
            isOnline = false
            return
        }

        let healthy = await probeHealthIfNeeded()
        isOnline = healthy
        guard healthy else { return }

        let due: [OutboxOperation]
        do {
            due = try outbox.dueOperations()
        } catch {
            Self.logger.error("dueOperations failed: \(error.localizedDescription)")
            return
        }

        if due.isEmpty {
            lastSyncCompletedAt = Date()
            return
        }

        for op in due {
            guard NetworkMonitor.shared.hasPath else { break }
            await processOne(op)
        }

        refreshFailedCount()
        lastSyncCompletedAt = Date()
    }

    /// Health probes are not free; cache the result for ~60s so a rapid-fire
    /// burst of requestSync calls (path change + foreground at the same
    /// moment, for example) doesn't ping /api/health 5 times.
    private func probeHealthIfNeeded() async -> Bool {
        if let last = lastHealthCheckAt, Date().timeIntervalSince(last) < Self.healthRecheckInterval,
           isOnline {
            return true
        }
        let ok = await HealthCheck.probe()
        lastHealthCheckAt = Date()
        return ok
    }

    private func processOne(_ op: OutboxOperation) async {
        do {
            try outbox.markSyncing(id: op.id)
            switch op.opType {
            case .memoCreate:
                try await processMemoCreate(op)
            }
            try outbox.delete(id: op.id)
        } catch {
            await recordFailure(op: op, error: error)
        }
    }

    private func processMemoCreate(_ op: OutboxOperation) async throws {
        // Decode the payload we stashed at enqueue time. Same struct shape
        // as the server's CreateMemoRequest contract — see LocalMemo.CreatePayload.
        let decoder = JSONDecoder()
        let payload = try decoder.decode(LocalMemo.CreatePayload.self, from: op.payload)

        // Server returns the saved memo whether we got 201 (fresh insert)
        // or 200 (idempotent retry hit). Either way, the response carries
        // the INTEGER server id we want to stash locally.
        struct ServerMemo: Decodable {
            let id: Int64
            let bodyMd: String
            let createdAt: String
            let updatedAt: String
        }

        let response: ServerMemo = try await api.post(path: "/api/memos", body: payload)
        try memos.markSynced(localId: op.targetId, serverId: response.id, syncedAt: Date())
    }

    private func recordFailure(op: OutboxOperation, error: Error) async {
        let attempts = op.attempts + 1
        let nextRetry: Date?
        if attempts >= Self.maxAttempts {
            nextRetry = nil
            Self.logger.error("op \(op.id) exhausted retries: \(error.localizedDescription)")
        } else {
            // Exponential backoff capped at 5 min. attempts=1 -> 1s, 2 -> 2s,
            // 3 -> 4s, ..., 9 -> 256s, 10 -> 300s cap.
            let delay = min(Self.maxBackoff, Self.baseBackoff * pow(2.0, Double(attempts - 1)))
            nextRetry = Date().addingTimeInterval(delay)
        }
        do {
            try outbox.markFailed(
                id: op.id,
                attempts: attempts,
                error: error.localizedDescription,
                nextRetryAt: nextRetry
            )
        } catch {
            Self.logger.error("could not mark outbox failure: \(error.localizedDescription)")
        }
    }

    private func refreshFailedCount() {
        do {
            failedCount = try outbox.failedCount()
        } catch {
            Self.logger.error("failedCount query failed: \(error.localizedDescription)")
        }
    }
}
