import Foundation

/// Storage Mode (offline support plan Phase 8): where the app's data lives.
/// Raw values are persisted in App Group UserDefaults — do not rename.
enum AppMode: String {
    /// Server-backed: the pre-Phase-8 behavior, including the optional
    /// "Offline Sync (Beta)" layer.
    case server
    /// Local-only: everything lives in the on-device database, no server
    /// required. The default for fresh installs.
    case standalone
}

class Settings {
    static let shared = Settings()

    // App Group identifier for sharing data between app and extension
    private let appGroupIdentifier = "group.com.memegtd.app"

    private var userDefaults: UserDefaults? {
        suiteOverride ?? UserDefaults(suiteName: appGroupIdentifier)
    }

    /// Test seam: a scratch suite instead of the real App Group container.
    private let suiteOverride: UserDefaults?

    private let apiUrlKey = "apiUrl"
    private let offlineSyncEnabledKey = "offlineSyncEnabled"
    private let appModeKey = "appMode"

    private init() {
        self.suiteOverride = nil
    }

    /// Test-only initializer.
    init(userDefaults: UserDefaults) {
        self.suiteOverride = userDefaults
    }

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

    /// Storage Mode (offline support plan Phase 8). First-read resolution
    /// when the key is unset:
    /// - every fresh install starts .standalone (a just-installed app can
    ///   never have a URL configured), fully usable out of the box;
    /// - the apiUrl check matters in exactly one case: an EXISTING install
    ///   updated in place (UserDefaults survive the update, so the URL the
    ///   user once entered is still there) — that device keeps .server, so
    ///   upgrading server users see zero behavior change.
    /// The resolved value is persisted so the answer never flips later
    /// (e.g. when a URL is entered afterwards).
    var appMode: AppMode {
        get {
            if let mode = userDefaults?.string(forKey: appModeKey).flatMap(AppMode.init) {
                return mode
            }
            let resolved: AppMode = apiUrl != nil ? .server : .standalone
            userDefaults?.set(resolved.rawValue, forKey: appModeKey)
            return resolved
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
