import SwiftUI

struct SyncTitle: View {
    let title: String
    let lineLimit: Int?
    let waiting: Bool
    @ObservedObject private var connectivity = ConnectivityMonitor.shared

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 5) {
                if connectivity.isOfflineReadOnly && connectivity.state != .checking {
                    Image(systemName: "wifi.slash")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.textSecondary)
                        .accessibilityLabel(Text(connectivity.statusText))
                }
                Text(title)
                    .font(.headline)
                    .lineLimit(lineLimit)
            }
            if waiting {
                Text("Waiting to sync")
                    .font(.caption2)
                    .foregroundStyle(Color.accent)
            }
        }
    }
}

extension View {
    func pendingSyncDot(_ pending: Bool) -> some View {
        padding(.leading, pending ? 10 : 0)
            .overlay(alignment: .topLeading) {
                if pending {
                    Circle()
                        .fill(Color.accent)
                        .frame(width: 5, height: 5)
                        .padding(.top, 6)
                        .accessibilityLabel("Waiting to sync")
                }
            }
    }
}
