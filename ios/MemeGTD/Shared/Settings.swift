import Foundation

/// Storage Mode (offline support plan Phase 8): where the app's data lives.
/// Raw values are persisted in App Group UserDefaults — do not rename.
enum AppMode: String {
    /// Server-backed (default): the pre-Phase-8 behavior, including the
    /// optional "Offline Sync (Beta)" layer.
    case server
    /// Local-only: memos live in the on-device database, no server required.
    case standalone
}

class Settings {
    static let shared = Settings()

    // App Group identifier for sharing data between app and extension
    private let appGroupIdentifier = "group.com.memegtd.app"

    private var userDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupIdentifier)
    }

    private let apiUrlKey = "apiUrl"
    private let offlineSyncEnabledKey = "offlineSyncEnabled"
    private let appModeKey = "appMode"

    private init() {}

    var apiUrl: String? {
        get {
            userDefaults?.string(forKey: apiUrlKey)
        }
        set {
            userDefaults?.set(newValue, forKey: apiUrlKey)
        }
    }

    /// "Offline Sync (Beta)" opt-in (offline support plan S5). Defaults to
    /// false: with the key unset, behavior is exactly the pre-sync,
    /// online-only app.
    var offlineSyncEnabled: Bool {
        get {
            userDefaults?.bool(forKey: offlineSyncEnabledKey) ?? false
        }
        set {
            userDefaults?.set(newValue, forKey: offlineSyncEnabledKey)
        }
    }

    /// Storage Mode (offline support plan Phase 8). Defaults to .server:
    /// with the key unset (every existing install), behavior is exactly the
    /// pre-Phase-8, server-backed app.
    var appMode: AppMode {
        get {
            userDefaults?.string(forKey: appModeKey).flatMap(AppMode.init) ?? .server
        }
        set {
            userDefaults?.set(newValue.rawValue, forKey: appModeKey)
        }
    }

    // Default API URL for initial setup
    static let defaultApiUrl = "http://localhost:3001"

    // Get API URL with fallback to default
    var effectiveApiUrl: String {
        apiUrl ?? Settings.defaultApiUrl
    }
}
