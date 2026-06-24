import SwiftUI

/// Tiny status bar shown above the memo list when the device is offline, a
/// sync is in flight, there are queued writes waiting to be sent, or there
/// are unresolved sync conflicts. Hides itself completely on the happy
/// path (online + caught up + idle). Tapping it opens whichever sheet is
/// most relevant to the current state.
struct OfflineBanner: View {
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @EnvironmentObject var syncEngine: SyncEngine
    @EnvironmentObject var memoStore: MemoStore

    @State private var showOutboxSheet = false
    @State private var showConflictSheet = false

    var body: some View {
        if let text = bannerText {
            Button {
                if memoStore.conflictCount > 0 {
                    showConflictSheet = true
                } else if memoStore.pendingCount > 0 {
                    showOutboxSheet = true
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: iconName)
                        .font(.caption2)
                    Text(text)
                        .font(.caption)
                    Spacer()
                    if memoStore.conflictCount > 0 || memoStore.pendingCount > 0 {
                        Image(systemName: "chevron.right")
                            .font(.caption2)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(bannerColor.opacity(0.15))
                .foregroundStyle(bannerColor)
            }
            .buttonStyle(.plain)
            .disabled(memoStore.conflictCount == 0 && memoStore.pendingCount == 0)
            .transition(.move(edge: .top).combined(with: .opacity))
            .sheet(isPresented: $showConflictSheet) {
                ConflictResolveSheet()
            }
            .sheet(isPresented: $showOutboxSheet) {
                OutboxStatusSheet()
            }
        }
    }

    private var bannerText: String? {
        if memoStore.conflictCount > 0 {
            return memoStore.conflictCount == 1
                ? "Sync paused — 1 conflict. Tap to resolve."
                : "Sync paused — \(memoStore.conflictCount) conflicts. Tap to resolve."
        }
        let pending = memoStore.pendingCount
        if !networkMonitor.isOnline {
            return pending > 0 ? "Offline · \(pending) pending" : "Offline"
        }
        if syncEngine.isSyncing {
            return pending > 0 ? "Syncing · \(pending) pending" : "Syncing..."
        }
        if pending > 0 {
            return "\(pending) pending"
        }
        return nil
    }

    private var iconName: String {
        if memoStore.conflictCount > 0 { return "exclamationmark.triangle.fill" }
        if !networkMonitor.isOnline { return "wifi.slash" }
        if syncEngine.isSyncing { return "arrow.triangle.2.circlepath" }
        return "clock.arrow.circlepath"
    }

    private var bannerColor: Color {
        if memoStore.conflictCount > 0 { return .red }
        if !networkMonitor.isOnline { return .secondary }
        return .accentColor
    }
}
