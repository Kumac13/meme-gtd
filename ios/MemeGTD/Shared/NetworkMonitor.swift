import Foundation
import Network
import Combine

/// Observes network reachability so the app can show offline state and so
/// the SyncEngine can flush the Outbox when connectivity returns.
///
/// `isOnline` is conservative: it is `true` only when a usable path exists
/// (not `requiresConnection`). Constrained / expensive paths still count as
/// online — the user may explicitly choose to use them.
@MainActor
final class NetworkMonitor: ObservableObject {
    static let shared = NetworkMonitor()

    /// Reachability flag. The very first read can happen before the first
    /// pathUpdateHandler callback arrives, so we seed it from the
    /// synchronous currentPath snapshot to avoid the brief "shows online
    /// while actually offline" window at launch.
    @Published private(set) var isOnline: Bool

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "name.kumac.MemeGTD.NetworkMonitor")

    /// Fires once when isOnline transitions from false → true. Subscribers
    /// can react to "we just came back online" without a Combine pipeline.
    let didComeOnline = PassthroughSubject<Void, Never>()

    private var didStart = false

    private init() {
        self.isOnline = monitor.currentPath.status == .satisfied
    }

    /// Starts monitoring. Idempotent — safe to call multiple times.
    func start() {
        guard !didStart else { return }
        didStart = true
        monitor.pathUpdateHandler = { [weak self] path in
            let nextOnline = path.status == .satisfied
            Task { @MainActor [weak self] in
                guard let self else { return }
                let wasOnline = self.isOnline
                self.isOnline = nextOnline
                if !wasOnline && nextOnline {
                    self.didComeOnline.send(())
                }
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}
