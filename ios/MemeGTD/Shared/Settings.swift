import Foundation

class Settings {
    static let shared = Settings()

    // App Group identifier for sharing data between app and extension
    private let appGroupIdentifier = "group.com.memegtd.app"

    private var userDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupIdentifier)
    }

    private let apiUrlKey = "apiUrl"

    private init() {}

    var apiUrl: String? {
        get {
            userDefaults?.string(forKey: apiUrlKey)
        }
        set {
            userDefaults?.set(newValue, forKey: apiUrlKey)
        }
    }

    // Default API URL for initial setup
    static let defaultApiUrl = "http://localhost:3001"

    // Get API URL with fallback to default
    var effectiveApiUrl: String {
        apiUrl ?? Settings.defaultApiUrl
    }
}
