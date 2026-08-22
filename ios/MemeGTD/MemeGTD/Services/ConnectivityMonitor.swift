import Combine
import Foundation
import Network

/// Connectivity state behind the offline read-only UI (offline support plan
/// Phase 7). "Offline" means THE SERVER CANNOT BE REACHED — the VERDICT never
/// comes from the device's own network state. With the server behind a VPN
/// (Tailscale) the device path is routinely fine while the server is
/// unreachable (and a dev server on localhost is reachable with no path at
/// all), so a path-based verdict is exactly the bug this replaces. Only
/// evidence about the server itself changes the state:
///
/// - Real request outcomes (primary): APIClient announces every transport
///   result (`.apiServerReachable` / `.apiServerUnreachable`). Any HTTP
///   response proves the server is reachable; a transport-level failure
///   proves it is not (cancellations prove nothing and are never posted).
///   Sync runs, list loads and saves keep this fresh without extra traffic.
/// - Confirmation before flipping offline: an AMBIGUOUS failure (e.g. one
///   slow GET hitting its 15s timeout against a live server) does not flip
///   the state by itself — it triggers a `GET /api/health` probe, and only
///   the probe's own failure declares the server unreachable. A DEFINITIVE
///   failure (connection refused, host not found, no route, radio off —
///   `APIClient.definitiveFailureKey`) needs no second opinion and flips the
///   state at once, so a stopped server or a dropped tunnel shows up
///   immediately instead of after another probe's timeout.
/// - Recovery loop: while offline the probe repeats every `recheckInterval`
///   so recovery (or continued outage) is confirmed even when no screen is
///   driving requests. The loop never depends on the probes' outcomes to
///   stay alive, and it survives mode switches (it just skips probing
///   outside Server mode and picks up again on the next tick).
/// - Path changes and scene activation as TRIGGERS only: an NWPathMonitor
///   fires an immediate probe whenever the device's network path changes
///   (airplane mode, Wi-Fi loss/regain, cold launch), and `MemeGTDApp` calls
///   `sceneDidBecomeActive()` on foregrounding — a suspended app runs neither
///   the recovery loop nor any request, so returning to it must re-check at
///   once rather than show a stale state for up to `recheckInterval`. Neither
///   trigger decides anything — the probe against the server does.
///
/// The default is "online" so screens render exactly as before until the
/// server itself proves unreachable (Apple's guidance: judge connectivity
/// from real request results, never preflight).
///
/// SyncScheduler keeps its own NWPathMonitor — that one decides when to
/// ATTEMPT a sync; this one only schedules reachability probes.
@MainActor
final class ConnectivityMonitor: ObservableObject {
    static let shared = ConnectivityMonitor()

    @Published private(set) var isOffline = false

    private var pathMonitor: NWPathMonitor?
    private var recoveryTask: Task<Void, Never>?
    private var verifyTask: Task<Void, Never>?
    private var pathProbeTask: Task<Void, Never>?
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
        ) { notification in
            let definitive = notification.userInfo?[APIClient.definitiveFailureKey] as? Bool ?? false
            Task { @MainActor [weak self] in
                self?.serverReportedUnreachable(definitive: definitive)
            }
        })
        startPathMonitor()
    }

    /// True while the offline READ-ONLY state applies to tasks and articles:
    /// SERVER mode with the server unreachable (Server mode always syncs).
    /// The appMode check matters: Standalone is never read-only — everything
    /// is local, so a stray `isOffline` (e.g. from a failed Settings
    /// connection test) has no UI effect there.
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
            startRecoveryLoop()
        } else {
            // Cancel everything that could stale-flip the state back to
            // offline after a request has just proven the server reachable:
            // the recovery loop's in-flight probe and any pending
            // verification probe. Cancellation propagates into URLSession,
            // and cancelled probes never post the unreachable signal.
            recoveryTask?.cancel()
            recoveryTask = nil
            verifyTask?.cancel()
            verifyTask = nil
        }
    }

    /// A request died at the transport level.
    ///
    /// A DEFINITIVE failure is proof in itself and flips the state right away.
    /// An ambiguous one (a timeout above all) is confirmed with a health probe
    /// first — one slow request must not put the whole app into read-only.
    /// While offline (or while a confirmation is already running) there is
    /// nothing to do: the recovery loop owns re-probing.
    private func serverReportedUnreachable(definitive: Bool) {
        if definitive {
            setOffline(true)
            return
        }
        guard !isOffline, verifyTask == nil else { return }
        verifyTask = Task { [weak self] in
            let reachable = await APIClient.shared.probeServerReachability()
            guard let self, !Task.isCancelled else {
                // Cancelled means setOffline(false) already ran and cleared
                // verifyTask — a request proved the server reachable while
                // we were probing, so this verdict is stale either way.
                return
            }
            self.verifyTask = nil
            if !reachable {
                self.setOffline(true)
            }
        }
    }

    // MARK: - Probing

    /// While offline — and only then — re-probe on a fixed cadence so
    /// recovery is noticed even when the user is not driving any requests.
    /// The loop is self-sustaining: it does NOT rely on probe outcomes or
    /// notifications to schedule the next tick (a probe that cannot run —
    /// wrong mode, malformed URL — just means this tick passes), so it can
    /// only end by being cancelled when the server is reachable again.
    private func startRecoveryLoop() {
        guard recoveryTask == nil else { return }
        let interval = recheckInterval
        recoveryTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                if Task.isCancelled { return }
                guard Settings.shared.appMode == .server else { continue }
                // Verdict flows back through the reachability notifications.
                _ = await APIClient.shared.probeServerReachability()
            }
        }
    }

    /// Device path changes (airplane mode, Wi-Fi loss/regain, cold launch's
    /// initial callback) fire an immediate probe so the state reacts within
    /// seconds. The path status is never the verdict — a probe against the
    /// server is.
    private func startPathMonitor() {
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { _ in
            Task { @MainActor [weak self] in
                self?.probeNow()
            }
        }
        monitor.start(queue: DispatchQueue.global(qos: .utility))
        pathMonitor = monitor
    }

    /// Called by `MemeGTDApp` when the scene becomes active. A suspended app
    /// neither runs the recovery loop nor issues requests, so the state on
    /// screen right after foregrounding is only as fresh as the last thing
    /// that happened before the app went away — re-check it immediately, in
    /// both directions (the server may have come back, or gone away).
    func sceneDidBecomeActive() {
        probeNow()
    }

    /// Fires one probe unless another is already in flight. The verdict flows
    /// back through the reachability notifications like every other request.
    private func probeNow() {
        guard Settings.shared.appMode == .server else { return }
        guard pathProbeTask == nil else { return }
        pathProbeTask = Task { [weak self] in
            _ = await APIClient.shared.probeServerReachability()
            self?.pathProbeTask = nil
        }
    }
}
