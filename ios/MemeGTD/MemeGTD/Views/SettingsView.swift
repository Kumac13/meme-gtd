import SwiftUI

struct SettingsView: View {
    let onMenuTap: () -> Void

    @EnvironmentObject var memoStore: MemoStore
    @State private var apiUrl: String = Settings.shared.apiUrl ?? Settings.defaultApiUrl
    @State private var isSaved: Bool = false
    @State private var isTestingConnection: Bool = false
    @State private var connectionStatus: ConnectionStatus = .unknown
    @State private var showOutboxSheet: Bool = false
    @State private var showConflictSheet: Bool = false

    enum ConnectionStatus {
        case unknown
        case success
        case failure
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // API Configuration section
                VStack(alignment: .leading, spacing: 12) {
                    Text("API Configuration")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.textSecondary)
                        .textCase(.uppercase)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Server URL")
                            .font(.system(size: 15))
                            .foregroundColor(.textPrimary)

                        TextField("http://localhost:3001", text: $apiUrl)
                            .font(.system(size: 14))
                            .padding(12)
                            .background(Color(.tertiarySystemFill))
                            .cornerRadius(10)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .tint(.accent)
                    }

                    // Connection status
                    if connectionStatus != .unknown {
                        HStack(spacing: 6) {
                            Image(systemName: connectionStatus == .success ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .font(.system(size: 13))
                            Text(connectionStatus == .success ? "Connected" : "Connection failed")
                                .font(.system(size: 13))
                        }
                        .foregroundColor(connectionStatus == .success ? .accent : .red)
                    }

                    // Buttons
                    HStack(spacing: 10) {
                        Button(action: testConnection) {
                            HStack(spacing: 6) {
                                if isTestingConnection {
                                    ProgressView()
                                        .scaleEffect(0.7)
                                        .tint(.accent)
                                } else {
                                    Image(systemName: "network")
                                        .font(.system(size: 13))
                                }
                                Text("Test")
                                    .font(.system(size: 14, weight: .medium))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color(.tertiarySystemFill))
                            .foregroundColor(.accent)
                            .cornerRadius(10)
                        }
                        .disabled(isTestingConnection)

                        Button(action: saveSettings) {
                            HStack(spacing: 6) {
                                Image(systemName: isSaved ? "checkmark" : "square.and.arrow.down")
                                    .font(.system(size: 13))
                                Text(isSaved ? "Saved" : "Save")
                                    .font(.system(size: 14, weight: .medium))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color.accent)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)

                Divider().padding(.leading, 16)

                // Sync section — entry points to the offline queue and any
                // unresolved conflicts. Both rows hide themselves when the
                // queue is empty / no conflicts exist, so the section is
                // invisible on the happy path.
                if memoStore.pendingCount > 0 || memoStore.conflictCount > 0 {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Sync")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.textSecondary)
                            .textCase(.uppercase)

                        if memoStore.conflictCount > 0 {
                            syncRow(
                                icon: "exclamationmark.triangle.fill",
                                iconColor: .red,
                                title: "Resolve sync conflicts",
                                detail: memoStore.conflictCount == 1
                                    ? "1 memo could not be synced"
                                    : "\(memoStore.conflictCount) memos could not be synced"
                            ) {
                                showConflictSheet = true
                            }
                        }

                        if memoStore.pendingCount > 0 {
                            syncRow(
                                icon: "clock.arrow.circlepath",
                                iconColor: .textSecondary,
                                title: "View pending operations",
                                detail: memoStore.pendingCount == 1
                                    ? "1 pending"
                                    : "\(memoStore.pendingCount) pending"
                            ) {
                                showOutboxSheet = true
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 16)

                    Divider().padding(.leading, 16)
                }

                // How to use section
                VStack(alignment: .leading, spacing: 12) {
                    Text("How to use")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.textSecondary)
                        .textCase(.uppercase)

                    VStack(alignment: .leading, spacing: 10) {
                        InstructionRow(number: "1", text: "Enter your API URL (e.g., Tailscale IP)")
                        InstructionRow(number: "2", text: "Tap Save to store the settings")
                        InstructionRow(number: "3", text: "Open Safari and navigate to an article")
                        InstructionRow(number: "4", text: "Tap Share and select \"Meme GTD\"")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
        }
        .scrollDismissesKeyboard(.immediately)
        .background(Color(.systemBackground))
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onMenuTap) {
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.textPrimary)
                }
            }
            ToolbarItem(placement: .principal) {
                Text("Settings")
                    .font(.headline)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showOutboxSheet) { OutboxStatusSheet() }
        .sheet(isPresented: $showConflictSheet) { ConflictResolveSheet() }
    }

    @ViewBuilder
    private func syncRow(
        icon: String,
        iconColor: Color,
        title: String,
        detail: String,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            HapticManager.impact(.light)
            action()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(iconColor)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 15))
                        .foregroundColor(.textPrimary)
                    Text(detail)
                        .font(.caption)
                        .foregroundColor(.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.textSecondary)
            }
            .padding(12)
            .background(Color(.tertiarySystemFill))
            .cornerRadius(10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func saveSettings() {
        Settings.shared.apiUrl = apiUrl
        HapticManager.notification(.success)
        withAnimation {
            isSaved = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation {
                isSaved = false
            }
        }
    }

    private func testConnection() {
        isTestingConnection = true
        connectionStatus = .unknown
        Settings.shared.apiUrl = apiUrl

        Task {
            let success = await APIClient.shared.testConnection()
            await MainActor.run {
                connectionStatus = success ? .success : .failure
                isTestingConnection = false
                HapticManager.notification(success ? .success : .error)
            }
        }
    }
}
