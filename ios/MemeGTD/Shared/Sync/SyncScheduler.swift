import Foundation
import Network
import os

private nonisolated let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "SyncScheduler")

/// Decides WHEN the SyncEngine runs (the engine itself decides WHAT to do).
///
/// Trigger points (offline support plan S2):
/// - `start()` — initial sync when offline sync turns on (this doubles as the
///   initial full pull: the cursor starts at 0, so the first pull seeds the
///   local database)
/// - connectivity regained (NWPathMonitor)
/// - scene became active (`sceneDidBecomeActive()`, wired in MemeGTDApp)
/// - after each local write / pull-to-refresh (`requestSync()`)
/// - retry with backoff after a run that failed or left outbox operations
///   behind (see below)
///
/// Debounce: at most one run in flight plus one queued follow-up. Triggers
/// arriving during a run collapse into that single follow-up.
///
/// Retry: a run that errors or leaves the outbox non-empty schedules its own
/// follow-up with exponential backoff. Without this, a push that fails right
/// after "connectivity regained" (typical with a VPN: Wi-Fi is up before the
/// Tailscale tunnel is) would strand the outbox until the next external
/// trigger — which may never come while the user stays on one screen.
@MainActor
final class SyncScheduler {
    private let engine: SyncEngine
    private let retryDelays: [TimeInterval]
    private var monitor: NWPathMonitor?
    private var isSyncing = false
    private var followUpRequested = false
    private var wasConnected: Bool?
    private var retryTask: Task<Void, Never>?
    private var retryAttempt = 0

    init(engine: SyncEngine, retryDelays: [TimeInterval] = [5, 15, 45, 120]) {
        self.engine = engine
        self.retryDelays = retryDelays
    }

    /// Begins watching connectivity and kicks off an initial sync.
    /// Idempotent: calling it again while already started does nothing.
    func start() {
        guard monitor == nil else { return }
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            let satisfied = path.status == .satisfied
            Task { @MainActor [weak self] in
                self?.connectivityChanged(satisfied: satisfied)
            }
        }
        monitor.start(queue: DispatchQueue.global(qos: .utility))
        self.monitor = monitor
        requestSync()
    }

    /// Stops connectivity monitoring (used when offline sync turns off).
    func stop() {
        monitor?.cancel()
        monitor = nil
        wasConnected = nil
        retryTask?.cancel()
        retryTask = nil
        retryAttempt = 0
    }

    /// Trigger from MemeGTDApp when the scene becomes active.
    func sceneDidBecomeActive() {
        requestSync()
    }

    /// Requests a sync run. Serialized: when a run is already in flight the
    /// request collapses into a single queued follow-up run.
    func requestSync() {
        retryTask?.cancel()
        retryTask = nil
        if isSyncing {
            followUpRequested = true
            return
        }
        isSyncing = true
        let engine = engine
        Task { [weak self] in
            let summary = await engine.syncNow()
            guard let self else { return }
            self.isSyncing = false
            if self.followUpRequested {
                self.followUpRequested = false
                self.requestSync()
            } else {
                self.scheduleRetryIfNeeded(after: summary)
            }
        }
    }

    /// After a run that failed or left outbox operations behind, schedule a
    /// self-triggered follow-up. The attempt counter resets on the first
    /// clean run, so backoff never grows past a healthy sync.
    private func scheduleRetryIfNeeded(after summary: SyncSummary) {
        guard !summary.errors.isEmpty || summary.remainingOutboxCount > 0 else {
            retryAttempt = 0
            return
        }
        let delay = retryDelays[min(retryAttempt, retryDelays.count - 1)]
        retryAttempt += 1
        logger.info("Scheduling sync retry #\(self.retryAttempt) in \(delay)s (remaining=\(summary.remainingOutboxCount), errors=\(summary.errors.count))")
        retryTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            guard !Task.isCancelled else { return }
            self?.requestSync()
        }
    }

    private func connectivityChanged(satisfied: Bool) {
        let regained = satisfied && wasConnected == false
        wasConnected = satisfied
        if regained {
            logger.info("Connectivity regained, requesting sync")
            requestSync()
        } else if satisfied && retryTask != nil {
            // The path changed while a failed run awaits its backoff — e.g.
            // the VPN interface came up after Wi-Fi did. Sync now instead of
            // waiting out the delay.
            logger.info("Path changed while retry pending, requesting sync")
            requestSync()
        }
    }
}
