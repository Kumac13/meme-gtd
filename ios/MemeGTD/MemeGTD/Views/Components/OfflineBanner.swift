import Combine
import Network
import SwiftUI

/// UI-facing connectivity state (offline support plan Phase 7). A lightweight
/// NWPathMonitor wrapper, deliberately independent from SyncScheduler's
/// monitor (that one triggers sync runs; this one only drives the read-only
/// banner and edit-control disabling in task/article screens).
///
/// The default is "online" so screens render exactly as before until the
/// monitor reports an unsatisfied path.
@MainActor
final class ConnectivityMonitor: ObservableObject {
    static let shared = ConnectivityMonitor()

    @Published private(set) var isOffline = false

    private let monitor = NWPathMonitor()

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let offline = path.status != .satisfied
            Task { @MainActor [weak self] in
                guard let self, self.isOffline != offline else { return }
                self.isOffline = offline
            }
        }
        monitor.start(queue: DispatchQueue.global(qos: .utility))
    }
}

/// Banner shown on task/article screens while the "Offline Sync (Beta)"
/// setting is on and the device is offline: those types are served from the
/// local read cache and cannot be edited. Renders nothing otherwise, so
/// embedding it is behavior-neutral for the default (toggle OFF) setup.
/// Memo screens never show it — memos stay editable offline via the outbox.
///
/// Styled as a floating capsule pill (same idiom as the conflict toast in
/// MemoListView), NOT an edge-to-edge material band: a full-width bar would
/// break the translucent glass look of the scroll edges.
struct OfflineBanner: View {
    let message: String

    @ObservedObject private var connectivity = ConnectivityMonitor.shared

    var body: some View {
        if Settings.shared.offlineSyncEnabled && connectivity.isOffline {
            HStack(spacing: 6) {
                Image(systemName: "wifi.slash")
                    .font(.system(size: 12, weight: .semibold))
                Text(message)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
            }
            .foregroundColor(.textSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(.regularMaterial, in: Capsule())
            .padding(.top, 4)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}
