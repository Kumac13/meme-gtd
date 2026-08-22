import Combine
import Foundation
import Network

/// Connectivity state behind the offline UI (offline support plan Phase 7).
///
/// The rules below are Apple's, not ours — the sources are cited per rule so
/// that changing one means arguing with the source, not with a preference:
///
/// - "Always attempt to make a connection. Do not attempt to guess whether
///   network service is available, and do not cache that determination." /
///   "The SCNetworkReachability API is not intended for use as a preflight
///   mechanism ... You determine network connectivity by attempting to
///   connect. If the connection fails, consult the [reachability] API to help
///   diagnose the cause of the failure." — Designing for Real-World Networks,
///   https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/NetworkingOverview/WhyNetworkingIsHard/WhyNetworkingIsHard.html
/// - "There's no such thing as an 'active internet connection' ... The device
///   might think that it has a path to the Internet, and that'll be reported
///   by NWPathMonitor, but that doesn't mean that a network connection to a
///   specific host will work. [Apps] talk to a specific service and so they
///   can make decisions based on their attempts to connect to that service.
///   That is the approach I recommend." — Apple DTS,
///   https://developer.apple.com/forums/thread/733178
/// - "Don't preflight network connections. Let the user try whatever they
///   want to try and then handle any errors you get." / reachability "is
///   subject to both false positives and false negatives." — Apple DTS,
///   https://developer.apple.com/forums/thread/99142
///
/// Hence: "offline" means THE SERVER CANNOT BE REACHED, and the VERDICT never
/// comes from the device's own network state. With the server behind a VPN
/// (Tailscale) the device path is routinely fine while the server is
/// unreachable (and a dev server on localhost is reachable with no path at
/// all), so a path-based verdict is exactly the bug this replaces.
///
/// On "do not cache that determination": the NETWORK layer never reads this
/// state — every data source still attempts the server first, every time, and
/// only falls back once that attempt has actually failed. What the cached
/// state feeds is the UI, which Apple sanctions ("display a UI indicating
/// that the network is offline"). The one place it goes further than Apple
/// describes is the read-only gating on a task's or an article's OWN fields:
/// those affordances are disabled while offline instead of letting the user
/// try and fail. That is a deliberate product rule (those rows have no outbox
/// path, so an attempt could only ever fail), and it is the reason a false
/// "offline" must stay cheap to recover from — hence the confirmation probe
/// and the tight first backoff step below. Comments are NOT gated: they queue.
///
/// Only evidence about the server itself changes the state:
///
/// - Real request outcomes (primary): APIClient announces every transport
///   result (`.apiServerReachable` / `.apiServerUnreachable`). Any HTTP
///   response proves the server is reachable; a transport-level failure
///   proves it is not (cancellations prove nothing and are never posted).
///   Sync runs, list loads and saves keep this fresh without extra traffic.
/// - Apple's transient/unreachable split decides how fast to flip. A
///   TRANSIENT failure ("try making the connection again") — a timeout, a
///   connection lost mid-flight — does not flip the state by itself: it
///   triggers a `HEAD /api/health` probe, and only the probe's own failure
///   declares the server unreachable, so one slow request cannot put the app
///   into read-only. A HOST-UNREACHABLE failure (connection refused, host not
///   found, no route, radio off — `APIClient.definitiveFailureKey`) is the
///   case Apple says to wait on an event for rather than retry into, so it
///   flips at once and a stopped server or a dropped tunnel shows up
///   immediately.
/// - The probe runs only AFTER a failure and while offline — never before a
///   request. Apple rules out preflight but names this move for a request
///   that has already stalled ("issue a HEAD request to your server ...
///   you're not doing a preflight check here because you only run this code
///   when you know that the request has stalled",
///   https://developer.apple.com/forums/thread/106344). It goes through
///   `APIClient`'s probe session, which opts into `waitsForConnectivity` so
///   that a device with no usable path reports itself through
///   `urlSession(_:taskIsWaitingForConnectivity:)` — the callback Apple names
///   for driving offline UI — instead of being guessed at.
/// - Recovery loop: while offline the probe repeats on a BACKOFF so recovery
///   is noticed even when no screen is driving requests. Apple's retry
///   guidance is event-driven first ("when the host becomes reachable again,
///   your app should retry the connection attempt automatically without user
///   intervention"), with time-based retry as an explicitly allowed fallback
///   ("back off to using whatever general retry logic is appropriate for your
///   app (time based, triggered by the user, triggered by a reachability
///   query, and so on)", QA1941). A server that is down produces no event at
///   all — no path change, no callback — so the timer is the only fallback
///   left, and it backs off instead of hammering a dead host forever. The
///   loop never depends on the probes' outcomes to stay alive, and it
///   survives mode switches (it just skips probing outside Server mode and
///   picks up again on the next tick).
/// - Path changes and scene activation as TRIGGERS only: an NWPathMonitor
///   fires an immediate probe whenever the device's network path changes
///   (airplane mode, Wi-Fi loss/regain, cold launch), and `MemeGTDApp` calls
///   `sceneDidBecomeActive()` on foregrounding — a suspended app runs neither
///   the recovery loop nor any request, so returning to it must re-check at
///   once rather than show a stale state. This is Apple's "when the host
///   becomes reachable again, your app should retry the connection attempt
///   automatically without user intervention" applied to the one event the
///   system does publish; because the path says nothing about the server,
///   neither trigger decides anything — the probe against the server does.
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
    /// Backoff for the recovery probe, same idiom as SyncScheduler's retry.
    /// Starts tight so a short outage is noticed almost immediately, settles
    /// at a minute so a long one costs nothing.
    private let recheckDelays: [TimeInterval] = [2, 5, 15, 30, 60]

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

    /// While offline — and only then — re-probe on a backing-off cadence so
    /// recovery is noticed even when the user is not driving any requests.
    /// The loop is self-sustaining: it does NOT rely on probe outcomes or
    /// notifications to schedule the next tick (a probe that cannot run —
    /// wrong mode, malformed URL — just means this tick passes), so it can
    /// only end by being cancelled when the server is reachable again. The
    /// event triggers below (path change, foregrounding) and any real request
    /// still short-circuit the wait; the timer only covers the case Apple's
    /// event-driven guidance cannot: a reachable network with a dead server.
    private func startRecoveryLoop() {
        guard recoveryTask == nil else { return }
        let delays = recheckDelays
        recoveryTask = Task {
            var attempt = 0
            while !Task.isCancelled {
                let delay = delays[min(attempt, delays.count - 1)]
                attempt += 1
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
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
