import Combine
import Network
import SwiftUI

/// UI-facing connectivity state (offline support plan Phase 7). A lightweight
/// NWPathMonitor wrapper, deliberately independent from SyncScheduler's
/// monitor (that one triggers sync runs; this one only drives the read-only
/// indication and edit-control disabling in task/article screens).
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

/// "Read-only" chip for task/article screens whose data is served from the
/// offline cache. Communicates the CONSEQUENCE (cannot edit), with the
/// wifi.slash glyph carrying the cause — the iWork "Read Only" document
/// indicator is the platform precedent. Same visual idiom as the status
/// chips (TaskTitleSection), so it reads as part of the item's state row.
///
/// Pure visual: callers decide visibility (detail views already track
/// `isOfflineReadOnly`); list screens use `OfflineReadOnlyIndicator` below.
struct OfflineReadOnlyBadge: View {
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 10, weight: .semibold))
            Text("Read-only")
                .font(.system(size: 12, weight: .medium))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .foregroundColor(.textSecondary)
        .background(Color(.systemGray).opacity(0.15))
        .clipShape(Capsule())
    }
}

/// Self-checking wrapper for the task/article LIST screens: shows the badge
/// only while the "Offline Sync (Beta)" setting is on and the device is
/// offline. Renders nothing otherwise, so embedding it is behavior-neutral
/// for the default (toggle OFF) setup. Memo screens never show it — memos
/// stay editable offline via the outbox.
///
/// Centered under the title bar. Sits snug to the toolbar (small top
/// padding) with a clear gap to the filter row below (bottom padding), so it
/// belongs to the title area rather than to the filters.
struct OfflineReadOnlyIndicator: View {
    @ObservedObject private var connectivity = ConnectivityMonitor.shared

    var body: some View {
        if Settings.shared.offlineSyncEnabled && connectivity.isOffline {
            OfflineReadOnlyBadge()
                .padding(.top, 2)
                .padding(.bottom, 8)
                .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}
