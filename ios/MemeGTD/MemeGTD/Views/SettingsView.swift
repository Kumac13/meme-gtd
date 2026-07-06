import SwiftUI

struct SettingsView: View {
    let onMenuTap: () -> Void

    @EnvironmentObject var dataSources: DataSourceProvider

    @State private var apiUrl: String = Settings.shared.apiUrl ?? Settings.defaultApiUrl
    @State private var isSaved: Bool = false
    @State private var isTestingConnection: Bool = false
    @State private var connectionStatus: ConnectionStatus = .unknown
    @State private var offlineSyncEnabled: Bool = Settings.shared.offlineSyncEnabled
    @State private var appMode: AppMode = Settings.shared.appMode

    // Migrate to Server flow (offline support plan Phase 12)
    @State private var migrationState: MigrationState = .idle
    @State private var migrationProgress: MigrationProgress?
    @State private var migrationSkippedCount: Int = 0
    @State private var migrationError: String?
    @State private var showMigrationConfirm: Bool = false
    @State private var isPreparingMigration: Bool = false

    enum ConnectionStatus {
        case unknown
        case success
        case failure
    }

    enum MigrationState {
        case idle
        case running
        case done
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Storage section (offline support plan Phase 8)
                VStack(alignment: .leading, spacing: 12) {
                    Text("Storage")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.textSecondary)
                        .textCase(.uppercase)

                    // Mode is not a free toggle: fresh installs start in
                    // Standalone, and the ONLY transition is the one-way
                    // "Migrate to Server" below (requirement: no way back
                    // from Server to Standalone).
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Storage Mode")
                                .font(.system(size: 15))
                                .foregroundColor(.textPrimary)
                            Spacer()
                            Text(appMode == .server ? "Server" : "Standalone")
                                .font(.system(size: 15))
                                .foregroundColor(.textSecondary)
                        }

                        if appMode == .standalone {
                            Text("Data is stored only on this device. Use \"Migrate to Server\" below to move it to a server. Migration is one-way.")
                                .font(.system(size: 13))
                                .foregroundColor(.textSecondary)
                        }
                    }
                    .onChange(of: appMode) { _, newValue in
                        Settings.shared.appMode = newValue
                        dataSources.storageSettingDidChange()
                        HapticManager.impact(.light)
                    }

                    if migrationState == .done {
                        Text(migrationCompleteMessage)
                            .font(.system(size: 13))
                            .foregroundColor(.accent)
                    }

                    // Migrate to Server flow: enter the server URL, verify
                    // the connection, confirm, then upload everything.
                    if appMode == .standalone {
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
                                .disabled(migrationState == .running)
                        }

                        if connectionStatus != .unknown {
                            HStack(spacing: 6) {
                                Image(systemName: connectionStatus == .success ? "checkmark.circle.fill" : "xmark.circle.fill")
                                    .font(.system(size: 13))
                                Text(connectionStatus == .success ? "Connected" : "Connection failed")
                                    .font(.system(size: 13))
                            }
                            .foregroundColor(connectionStatus == .success ? .accent : .red)
                        }

                        if migrationState == .running {
                            HStack(spacing: 10) {
                                ProgressView()
                                    .tint(.accent)
                                Text(migrationProgressText)
                                    .font(.system(size: 14))
                                    .foregroundColor(.textSecondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                        } else {
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
                                .disabled(isTestingConnection || isPreparingMigration)

                                Button(action: startMigrationFlow) {
                                    HStack(spacing: 6) {
                                        if isPreparingMigration {
                                            ProgressView()
                                                .scaleEffect(0.7)
                                                .tint(.white)
                                        } else {
                                            Image(systemName: "icloud.and.arrow.up")
                                                .font(.system(size: 13))
                                        }
                                        Text("Migrate to Server")
                                            .font(.system(size: 14, weight: .medium))
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                    .background(Color.accent)
                                    .foregroundColor(.white)
                                    .cornerRadius(10)
                                }
                                .disabled(isTestingConnection || isPreparingMigration)
                            }
                        }

                        if let migrationError {
                            Text(migrationError)
                                .font(.system(size: 13))
                                .foregroundColor(.red)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)

                // Server-backed settings are hidden while Standalone: neither
                // the API URL nor Offline Sync has any effect in that mode.
                if appMode == .server {
                    Divider().padding(.leading, 16)

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
                            dataSources.storageSettingDidChange()
                            HapticManager.impact(.light)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 16)
                }

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
        .alert("Migrate to Server", isPresented: $showMigrationConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Migrate", role: .destructive) { runMigration() }
        } message: {
            Text("Upload all on-device data to the server and switch to Server mode? This cannot be undone.")
        }
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

    // MARK: - Migrate to Server (offline support plan Phase 12)

    private var migrationProgressText: String {
        if let progress = migrationProgress, progress.total > 0 {
            return "Uploading \(progress.processed) of \(progress.total)..."
        }
        return "Preparing migration..."
    }

    private var migrationCompleteMessage: String {
        if migrationSkippedCount > 0 {
            return "Migration complete. \(migrationSkippedCount) item(s) were skipped and remain on this device."
        }
        return "Migration complete."
    }

    /// Step 1 of the flow: verify the server is reachable, then ask for the
    /// irreversible confirmation. Nothing is uploaded yet.
    private func startMigrationFlow() {
        migrationError = nil
        connectionStatus = .unknown
        isPreparingMigration = true
        Settings.shared.apiUrl = apiUrl

        Task {
            let success = await APIClient.shared.testConnection()
            await MainActor.run {
                isPreparingMigration = false
                connectionStatus = success ? .success : .failure
                if success {
                    showMigrationConfirm = true
                } else {
                    HapticManager.notification(.error)
                }
            }
        }
    }

    /// Step 2 (after the confirmation dialog): upload everything. On success
    /// the service has already committed Server mode + Offline Sync; updating
    /// the local state triggers the onChange handlers, which rebuild the data
    /// sources and start the sync scheduler (initial pull). On failure the
    /// app stays Standalone and the flow can simply be retried — the
    /// migration is idempotent.
    private func runMigration() {
        migrationState = .running
        migrationProgress = nil
        migrationError = nil

        Task {
            let service = MigrationService(database: AppDatabase.shared)
            do {
                let summary = try await service.migrate { progress in
                    Task { @MainActor in
                        migrationProgress = progress
                    }
                }
                await MainActor.run {
                    migrationSkippedCount = summary.skippedCount
                    migrationState = .done
                    HapticManager.notification(.success)
                    // Reflect the committed settings; each onChange persists
                    // the (already stored) value and rebuilds the provider.
                    offlineSyncEnabled = true
                    appMode = .server
                }
            } catch {
                await MainActor.run {
                    migrationState = .idle
                    migrationError = error.localizedDescription
                    HapticManager.notification(.error)
                }
            }
        }
    }
}
