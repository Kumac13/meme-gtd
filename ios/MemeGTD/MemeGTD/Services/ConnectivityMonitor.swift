import Combine
import Foundation
import Network

@MainActor
final class ConnectivityMonitor: ObservableObject {
    static let shared = ConnectivityMonitor()

    enum State { case checking, available, unreachable, serverError }
    @Published private(set) var state: State = .checking
    @Published private(set) var hasNoNetworkPath = false
    var isOfflineReadOnly: Bool { Settings.shared.appMode == .server && state != .available }
    var statusText: String {
        switch state {
        case .checking: return "Checking server…"
        case .serverError: return "Server returned an error"
        case .unreachable: return hasNoNetworkPath ? "Offline" : "Server unavailable"
        case .available: return "Connected"
        }
    }

    private var pathMonitor: NWPathMonitor?
    private var recoveryTask: Task<Void, Never>?
    private var pathProbeTask: Task<Void, Never>?
    private var observers: [any NSObjectProtocol] = []
    private let recheckInterval: TimeInterval = 30

    private init() {
        let signals: [Notification.Name] = [
            .apiServerReachable, .apiServerUnreachable, .apiRequestServerError,
            .apiHealthReady, .apiHealthUnreachable, .apiHealthError,
        ]
        for name in signals {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { note in
                let endpoint = note.object as? String
                Task { @MainActor [weak self] in
                    guard let self, endpoint == Settings.shared.effectiveApiUrl else { return }
                    switch name {
                    case .apiHealthUnreachable: self.setState(.unreachable)
                    case .apiHealthError: self.setState(.serverError)
                    case .apiRequestServerError: self.probeHealth()
                    case .apiServerUnreachable:
                        if self.state == .checking || self.state == .unreachable {
                            self.setState(.unreachable)
                        } else { self.probeHealth() }
                    case .apiHealthReady: self.setState(.available)
                    default:
                        if self.state == .serverError { break }
                        self.setState(.available)
                    }
                }
            })
        }
        startPathMonitor()
    }

    func checkEndpoint() {
        pathProbeTask?.cancel()
        pathProbeTask = nil
        state = .checking
        probeHealth()
    }

    private func setState(_ value: State) {
        if state != value { state = value }
        if value == .available {
            recoveryTask?.cancel()
            recoveryTask = nil
        } else { startRecoveryLoop() }
    }

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
        monitor.pathUpdateHandler = { path in
            let disconnected = path.status == .unsatisfied
            Task { @MainActor [weak self] in
                self?.hasNoNetworkPath = disconnected
                self?.probeHealth()
            }
        }
        monitor.start(queue: DispatchQueue.global(qos: .utility))
        pathMonitor = monitor
    }

    private func probeHealth() {
        guard Settings.shared.appMode == .server else { return }
        guard pathProbeTask == nil else { return }
        pathProbeTask = Task { [weak self] in
            // Verdict flows back through the reachability notifications.
            let client = APIClient.shared
            _ = await client.probeServerReachability()
            guard !Task.isCancelled, client.baseUrl == Settings.shared.effectiveApiUrl else { return }
            self?.pathProbeTask = nil
        }
    }
}
