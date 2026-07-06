import SwiftUI

struct SettingsView: View {
    let onMenuTap: () -> Void

    @EnvironmentObject var dataSources: DataSourceProvider

    @State private var apiUrl: String = Settings.shared.apiUrl ?? Settings.defaultApiUrl
    @State private var isSaved: Bool = false
    @State private var isTestingConnection: Bool = false
    @State private var connectionStatus: ConnectionStatus = .unknown
    @State private var appMode: AppMode = Settings.shared.appMode

    // Standalone -> Server is one-way (confirm before applying); Server ->
    // Standalone is not supported (blocked dialog in every build; DEBUG adds
    // a dev-only escape button for verification).
    @State private var showServerSwitchConfirm: Bool = false
    @State private var confirmedServerSwitch: Bool = false
    @State private var showStandaloneSwitchBlocked: Bool = false
    @State private var devStandaloneSwitchConfirmed: Bool = false
    @State private var isRevertingModeChange: Bool = false

    // Migrate to Server flow (offline support plan Phase 12)
    @State private var migrationState: MigrationState = .idle
    @State private var migrationProgress: MigrationProgress?
    @State private var migrationSkippedCount: Int = 0
    @State private var migrationError: String?
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

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Storage Mode")
                            .font(.system(size: 15))
                            .foregroundColor(.textPrimary)

                        Picker("Storage Mode", selection: $appMode) {
                            Text("Server").tag(AppMode.server)
                            Text("Standalone").tag(AppMode.standalone)
                        }
                        .pickerStyle(.segmented)
                        .disabled(migrationState == .running || isPreparingMigration)

                        if appMode == .standalone {
                            Text("Data is stored only on this device. Switching to Server uploads it to the server first.")
                                .font(.system(size: 13))
                                .foregroundColor(.textSecondary)
                        }
                    }
                    .onChange(of: appMode) { oldValue, newValue in
                        if isRevertingModeChange {
                            isRevertingModeChange = false
                            return
                        }
                        // Standalone -> Server is one-way and cannot be
                        // undone: confirm before applying. The migration
                        // completion path pre-sets confirmedServerSwitch (it
                        // has its own confirmation).
                        if oldValue == .standalone && newValue == .server && !confirmedServerSwitch {
                            isRevertingModeChange = true
                            appMode = .standalone
                            showServerSwitchConfirm = true
                            return
                        }
                        confirmedServerSwitch = false
                        // There is no way back from Server. Block the attempt
                        // and snap the picker; the blocked dialog is shown in
                        // every build (DEBUG adds a dev-only escape button so
                        // mode behavior stays verifiable on a dev device —
                        // devStandaloneSwitchConfirmed can only become true
                        // there).
                        if oldValue == .server && newValue == .standalone && !devStandaloneSwitchConfirmed {
                            isRevertingModeChange = true
                            appMode = .server
                            showStandaloneSwitchBlocked = true
                            return
                        }
                        devStandaloneSwitchConfirmed = false
                        Settings.shared.appMode = newValue
                        dataSources.storageSettingDidChange()
                        HapticManager.impact(.light)
                    }
                    .alert("Switch to Server?", isPresented: $showServerSwitchConfirm) {
                        Button("Cancel", role: .cancel) {}
                        Button("Switch", role: .destructive) {
                            startMigrationFlow()
                        }
                    } message: {
                        Text("All data on this device will be uploaded to the server, then the app will switch to Server mode. This cannot be undone. If the upload fails, nothing changes and you can try again.")
                    }
                    .alert("Cannot Switch to Standalone", isPresented: $showStandaloneSwitchBlocked) {
                        Button("OK", role: .cancel) {}
                        #if DEBUG
                        Button("Switch (Dev Only)", role: .destructive) {
                            devStandaloneSwitchConfirmed = true
                            appMode = .standalone
                        }
                        #endif
                    } message: {
                        Text("This app is connected to a server. Switching back to Standalone is not supported.")
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

                        if migrationState == .running || isPreparingMigration {
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

    /// Runs after the switch-to-Server confirmation: verify the server is
    /// reachable, then upload. Mode only changes when the upload fully
    /// succeeds (runMigration); any failure leaves Standalone untouched.
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
                    runMigration()
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
                    // Reflect the committed setting; onChange persists the
                    // (already stored) value and rebuilds the provider.
                    // Migration already confirmed its own dialog — skip the
                    // switch-to-Server confirmation.
                    confirmedServerSwitch = true
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
