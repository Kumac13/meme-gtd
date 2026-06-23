import SwiftUI

/// Tiny status bar shown above the memo list when the device is offline, a
/// sync is in flight, or there are queued writes waiting to be sent. Hides
/// itself completely on the happy path (online + caught up + idle).
struct OfflineBanner: View {
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @EnvironmentObject var syncEngine: SyncEngine
    @EnvironmentObject var memoStore: MemoStore

    var body: some View {
        if let text = bannerText {
            HStack(spacing: 6) {
                Image(systemName: iconName)
                    .font(.caption2)
                Text(text)
                    .font(.caption)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(bannerColor.opacity(0.15))
            .foregroundStyle(bannerColor)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    private var bannerText: String? {
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
        if !networkMonitor.isOnline { return "wifi.slash" }
        if syncEngine.isSyncing { return "arrow.triangle.2.circlepath" }
        return "clock.arrow.circlepath"
    }

    private var bannerColor: Color {
        if !networkMonitor.isOnline { return .secondary }
        return .accentColor
    }
}
