import Foundation

class Settings {
    static let shared = Settings()

    // App Group identifier for sharing data between app and extension
    private let appGroupIdentifier = "group.com.memegtd.app"

    private var userDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupIdentifier)
    }

    private let apiUrlKey = "apiUrl"
    private let offlineSyncEnabledKey = "offlineSyncEnabled"

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

    // Default API URL for initial setup
    static let defaultApiUrl = "http://localhost:3001"

    // Get API URL with fallback to default
    var effectiveApiUrl: String {
        apiUrl ?? Settings.defaultApiUrl
    }
}
