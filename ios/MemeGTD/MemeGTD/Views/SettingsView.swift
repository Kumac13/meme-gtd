import SwiftUI

struct SettingsView: View {
    let onMenuTap: () -> Void

    @EnvironmentObject var dataSources: DataSourceProvider

    @State private var apiUrl: String = Settings.shared.apiUrl ?? Settings.defaultApiUrl
    @State private var isSaved: Bool = false
    @State private var isTestingConnection: Bool = false
    @State private var connectionStatus: ConnectionStatus = .unknown
    @State private var offlineSyncEnabled: Bool = Settings.shared.offlineSyncEnabled

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

                // Sync section
                VStack(alignment: .leading, spacing: 12) {
                    Text("Sync")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.textSecondary)
                        .textCase(.uppercase)

                    Toggle(isOn: $offlineSyncEnabled) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Offline Sync (Beta)")
                                .font(.system(size: 15))
                                .foregroundColor(.textPrimary)
                            Text("Read and write memos offline. Changes sync with the server when you are back online.")
                                .font(.system(size: 13))
                                .foregroundColor(.textSecondary)
                        }
                    }
                    .tint(.accent)
                    .onChange(of: offlineSyncEnabled) { _, newValue in
                        Settings.shared.offlineSyncEnabled = newValue
                        dataSources.offlineSyncSettingDidChange()
                        HapticManager.impact(.light)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)

                Divider().padding(.leading, 16)

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
