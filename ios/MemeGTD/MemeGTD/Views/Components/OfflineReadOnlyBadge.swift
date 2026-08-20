import SwiftUI

/// "Read-only" chip for task/article screens whose data is served from the
/// offline cache. Communicates the CONSEQUENCE (cannot edit), with the
/// wifi.slash glyph carrying the cause — the iWork "Read Only" document
/// indicator is the platform precedent. Same visual idiom as the status
/// chips (TaskTitleSection), so it reads as part of the item's state row.
///
/// Pure visual: callers decide visibility (detail views already track
/// `isOfflineReadOnly`); list screens use `OfflineReadOnlyIndicator` below.
/// The state itself lives in `Services/ConnectivityMonitor.swift`, which
/// judges "offline" by server reachability.
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
/// only in Server mode while the server is unreachable
/// (`ConnectivityMonitor.isOfflineReadOnly`). Renders nothing otherwise, so
/// embedding it is behavior-neutral while online. Memo screens never show
/// it — memos stay editable offline via the outbox.
///
/// Centered under the title bar. Sits snug to the toolbar (small top
/// padding) with a clear gap to the filter row below (bottom padding), so it
/// belongs to the title area rather than to the filters.
struct OfflineReadOnlyIndicator: View {
    @ObservedObject private var connectivity = ConnectivityMonitor.shared

    var body: some View {
        if connectivity.isOfflineReadOnly {
            OfflineReadOnlyBadge()
                .padding(.top, 2)
                .padding(.bottom, 8)
                .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}
