import Combine
import Foundation

/// Connectivity state behind the offline read-only UI (offline support plan
/// Phase 7). "Offline" means THE SERVER CANNOT BE REACHED — the device's own
/// network state is deliberately never consulted. With the server behind a
/// VPN (Tailscale) the device path is routinely fine while the server is
/// unreachable (and a dev server on localhost is reachable with no path at
/// all), so a path-based verdict is exactly the bug this replaces. Only
/// evidence about the server itself changes the state:
///
/// - Real request outcomes (primary): APIClient announces every transport
///   result (`.apiServerReachable` / `.apiServerUnreachable`). Any HTTP
///   response proves the server is reachable; a transport-level failure
///   proves it is not (cancellations prove nothing and are never posted).
///   Sync runs, list loads and saves keep this fresh without extra traffic.
/// - Recovery probe: while offline — and only then — `GET /api/health`
///   every `recheckInterval`, so recovery (or continued outage) is
///   confirmed even when no screen is driving requests.
///
/// The default is "online" so screens render exactly as before until the
/// server itself proves unreachable; the first failed request flips the
/// state (Apple's guidance: judge connectivity from real request results,
/// never preflight).
///
/// SyncScheduler keeps its own NWPathMonitor — that one decides when to
/// ATTEMPT a sync (a cheap, always-correct trigger), not whether the app is
/// offline.
@MainActor
final class ConnectivityMonitor: ObservableObject {
    static let shared = ConnectivityMonitor()

    @Published private(set) var isOffline = false

    private var probeTask: Task<Void, Never>?
    private var recheckTask: Task<Void, Never>?
    private var observers: [any NSObjectProtocol] = []
    private let recheckInterval: TimeInterval = 30

    private init() {
        observers.append(NotificationCenter.default.addObserver(
            forName: .apiServerReachable, object: nil, queue: nil
        ) { _ in
            Task { @MainActor [weak self] in
                self?.setOffline(false)
            }
        })
        observers.append(NotificationCenter.default.addObserver(
            forName: .apiServerUnreachable, object: nil, queue: nil
        ) { _ in
            Task { @MainActor [weak self] in
                self?.setOffline(true)
            }
        })
    }

    /// True while the offline READ-ONLY state applies to tasks and articles:
    /// SERVER mode with the server unreachable (Server mode always syncs).
    /// The appMode check matters: Standalone is never read-only — everything
    /// is local, no requests ever fire, so `isOffline` stays at its default.
    /// All read-only gating in the Views goes through this single definition.
    var isOfflineReadOnly: Bool {
        Settings.shared.appMode == .server && isOffline
    }

    // MARK: - State

    private func setOffline(_ offline: Bool) {
        if isOffline != offline {
            isOffline = offline
        }
        if offline {
            scheduleRecheck()
        } else {
            recheckTask?.cancel()
            recheckTask = nil
        }
    }

    // MARK: - Recovery probe

    /// Asks the server for /api/health. The verdict flows back through the
    /// same `.apiServerReachable` / `.apiServerUnreachable` notifications
    /// every real request posts, so all state changes funnel through
    /// `setOffline`.
    private func probeServer() {
        guard Settings.shared.appMode == .server else { return }
        guard probeTask == nil else { return }
        probeTask = Task { [weak self] in
            _ = await APIClient.shared.probeServerReachability()
            self?.probeTask = nil
        }
    }

    /// While offline — and only then — re-probe on a fixed cadence so
    /// recovery is noticed even when the user is not driving any requests.
    /// Cancelled the moment any signal reports the server reachable again.
    private func scheduleRecheck() {
        guard recheckTask == nil else { return }
        let interval = recheckInterval
        recheckTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            guard let self, !Task.isCancelled else { return }
            self.recheckTask = nil
            self.probeServer()
        }
    }
}
