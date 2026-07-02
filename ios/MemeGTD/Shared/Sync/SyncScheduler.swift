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
///
/// Debounce: at most one run in flight plus one queued follow-up. Triggers
/// arriving during a run collapse into that single follow-up.
@MainActor
final class SyncScheduler {
    private let engine: SyncEngine
    private var monitor: NWPathMonitor?
    private var isSyncing = false
    private var followUpRequested = false
    private var wasConnected: Bool?

    init(engine: SyncEngine) {
        self.engine = engine
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
    }

    /// Trigger from MemeGTDApp when the scene becomes active.
    func sceneDidBecomeActive() {
        requestSync()
    }

    /// Requests a sync run. Serialized: when a run is already in flight the
    /// request collapses into a single queued follow-up run.
    func requestSync() {
        if isSyncing {
            followUpRequested = true
            return
        }
        isSyncing = true
        let engine = engine
        Task { [weak self] in
            await engine.syncNow()
            guard let self else { return }
            self.isSyncing = false
            if self.followUpRequested {
                self.followUpRequested = false
                self.requestSync()
            }
        }
    }

    private func connectivityChanged(satisfied: Bool) {
        let regained = satisfied && wasConnected == false
        wasConnected = satisfied
        if regained {
            logger.info("Connectivity regained, requesting sync")
            requestSync()
        }
    }
}
