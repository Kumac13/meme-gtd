import Combine
import Foundation
import Network
import os

/// Watches the network path and publishes a boolean: "is there any chance
/// our server is reachable right now?". NWPathMonitor by itself only tells
/// us whether iOS thinks we have ANY network — Wi-Fi, cellular, etc. It
/// can't tell us whether our Tailscale-internal API host is actually up,
/// which is why `SyncEngine` combines this with `HealthCheck`.
@MainActor
final class NetworkMonitor: ObservableObject {
    static let shared = NetworkMonitor()

    @Published private(set) var hasPath: Bool = false

    private let monitor: NWPathMonitor
    private let queue = DispatchQueue(label: "name.kumac.MemeGTD.NetworkMonitor")
    private static let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "NetworkMonitor")

    init() {
        let monitor = NWPathMonitor()
        self.monitor = monitor
        monitor.pathUpdateHandler = { [weak self] path in
            let reachable = path.status == .satisfied
            Task { @MainActor in
                self?.update(reachable: reachable)
            }
        }
        monitor.start(queue: queue)
        // Seed `hasPath` from the path NWPathMonitor already knows about
        // before we get our first async update callback. Without this, the UI
        // briefly renders "offline" (greyed FAB, disabled actions) for the
        // ~50–200ms between `start()` and the first callback even when the
        // network is actually fine.
        self.hasPath = monitor.currentPath.status == .satisfied
    }

    deinit {
        monitor.cancel()
    }

    private func update(reachable: Bool) {
        if hasPath != reachable {
            Self.logger.info("path changed: \(reachable ? "satisfied" : "unsatisfied")")
            hasPath = reachable
        }
    }
}
