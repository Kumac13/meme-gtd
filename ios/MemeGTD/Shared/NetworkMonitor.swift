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

    /// Reachability flag. Defaults to `true` so the OfflineBanner does not
    /// flash on launch — `NWPathMonitor.currentPath` is unreliable before
    /// `start()` has had a chance to deliver its first callback, so reading
    /// it synchronously here would frequently produce a false `.unsatisfied`
    /// result. The real value lands within milliseconds of `start()` via the
    /// pathUpdateHandler.
    @Published private(set) var isOnline: Bool = true

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "name.kumac.MemeGTD.NetworkMonitor")

    /// Fires once when isOnline transitions from false → true. Subscribers
    /// can react to "we just came back online" without a Combine pipeline.
    let didComeOnline = PassthroughSubject<Void, Never>()

    private var didStart = false

    private init() {}

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
