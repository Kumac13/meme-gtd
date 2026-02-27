import SwiftUI

struct SettingsView: View {
    let onMenuTap: () -> Void

    @State private var apiUrl: String = Settings.shared.apiUrl ?? Settings.defaultApiUrl
    @State private var isSaved: Bool = false
    @State private var isTestingConnection: Bool = false
    @State private var connectionStatus: ConnectionStatus = .unknown

    enum ConnectionStatus {
        case unknown
        case success
        case failure
    }

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Text("Meme GTD")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.textPrimary)

                    Text("Settings")
                        .font(.subheadline)
                        .foregroundColor(.textSecondary)
                }
                .padding(.top, 20)

                // Settings Card
                VStack(alignment: .leading, spacing: 16) {
                    Text("API Configuration")
                        .font(.headline)
                        .foregroundColor(.textPrimary)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("API URL")
                            .font(.subheadline)
                            .foregroundColor(.textSecondary)

                        TextField("http://localhost:3000", text: $apiUrl)
                            .textFieldStyle(CustomTextFieldStyle())
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                    }

                    // Connection status
                    if connectionStatus != .unknown {
                        HStack {
                            Image(systemName: connectionStatus == .success ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .foregroundColor(connectionStatus == .success ? .accent : .red)
                            Text(connectionStatus == .success ? "Connected" : "Connection failed")
                                .font(.subheadline)
                                .foregroundColor(connectionStatus == .success ? .accent : .red)
                        }
                    }

                    // Buttons
                    HStack(spacing: 12) {
                        Button(action: testConnection) {
                            HStack {
                                if isTestingConnection {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .accent))
                                        .scaleEffect(0.8)
                                } else {
                                    Image(systemName: "network")
                                }
                                Text("Test")
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.surface)
                            .foregroundColor(.accent)
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.accent, lineWidth: 1)
                            )
                        }
                        .disabled(isTestingConnection)

                        Button(action: saveSettings) {
                            HStack {
                                Image(systemName: isSaved ? "checkmark" : "square.and.arrow.down")
                                Text(isSaved ? "Saved" : "Save")
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.accent)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                        }
                    }
                }
                .padding(20)
                .background(Color.surface)
                .cornerRadius(12)
                .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 2)
                .padding(.horizontal, 20)

                // Instructions
                VStack(alignment: .leading, spacing: 12) {
                    Text("How to use")
                        .font(.headline)
                        .foregroundColor(.textPrimary)

                    VStack(alignment: .leading, spacing: 8) {
                        InstructionRow(number: "1", text: "Enter your API URL (e.g., Tailscale IP)")
                        InstructionRow(number: "2", text: "Tap Save to store the settings")
                        InstructionRow(number: "3", text: "Open Safari and navigate to an article")
                        InstructionRow(number: "4", text: "Tap Share and select \"Meme GTD\"")
                    }
                }
                .padding(20)
                .background(Color.surface)
                .cornerRadius(12)
                .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 2)
                .padding(.horizontal, 20)

                Spacer()
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: {
                    HapticManager.impact(.light)
                    onMenuTap()
                }) {
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.textPrimary)
                }
            }
        }
        .navigationTitle("")
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
