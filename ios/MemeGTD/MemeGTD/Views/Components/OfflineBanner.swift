import SwiftUI

/// Tiny status bar shown above the memo list when the device is offline or a
/// sync is in flight. Hides itself completely on the happy path.
struct OfflineBanner: View {
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @EnvironmentObject var syncEngine: SyncEngine

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
        if !networkMonitor.isOnline {
            return "Offline"
        }
        if syncEngine.isSyncing {
            return "Syncing..."
        }
        return nil
    }

    private var iconName: String {
        networkMonitor.isOnline ? "arrow.triangle.2.circlepath" : "wifi.slash"
    }

    private var bannerColor: Color {
        networkMonitor.isOnline ? .accentColor : .secondary
    }
}
