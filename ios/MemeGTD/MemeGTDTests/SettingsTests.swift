import XCTest
@testable import MemeGTD

/// Storage Mode first-read resolution (offline support plan Phase 8, revised):
/// fresh installs start Standalone, installs that already talk to a server
/// (apiUrl configured) stay Server, and the resolved answer is persisted so
/// it never flips later.
final class SettingsTests: XCTestCase {
    private var suiteName: String!
    private var defaults: UserDefaults!

    override func setUpWithError() throws {
        suiteName = "settings-tests-\(UUID().uuidString)"
        defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
    }

    func testSwitchingServerKeepsLegacyQueueAndCursorWithOriginalEndpoint() throws {
        let settings = Settings(userDefaults: defaults)
        settings.apiUrl = "https://a.example"
        let a = settings.databaseFilename
        let transportA = APISyncTransport(client: APIClient(baseUrl: settings.effectiveApiUrl))
        settings.apiUrl = "https://b.example"
        XCTAssertEqual(a, "local.sqlite")
        XCTAssertNotEqual(settings.databaseFilename, a)
        XCTAssertEqual(transportA.client.baseUrl, "https://a.example")
        let restarted = Settings(userDefaults: defaults)
        XCTAssertEqual(restarted.databaseFilename, settings.databaseFilename)
        restarted.apiUrl = "https://a.example"
        XCTAssertEqual(restarted.databaseFilename, a)
    }

    func testFreshInstallResolvesToStandaloneAndPersists() {
        let settings = Settings(userDefaults: defaults)

        XCTAssertEqual(settings.appMode, .standalone)
        // Persisted, not re-derived on every read.
        XCTAssertEqual(defaults.string(forKey: "appMode"), "standalone")
    }

    func testInstallWithConfiguredServerResolvesToServer() {
        // An upgrading server-mode user: apiUrl was set by explicit action
        // in an earlier version, appMode key does not exist yet.
        defaults.set("http://server.example:3000", forKey: "apiUrl")
        let settings = Settings(userDefaults: defaults)

        XCTAssertEqual(settings.appMode, .server)
        XCTAssertEqual(defaults.string(forKey: "appMode"), "server")
    }

    func testExplicitModeAlwaysWins() {
        defaults.set("server", forKey: "appMode")
        let settings = Settings(userDefaults: defaults)

        XCTAssertEqual(settings.appMode, .server, "explicit key beats the apiUrl heuristic")
    }

    func testResolutionDoesNotFlipWhenUrlIsEnteredLater() {
        let settings = Settings(userDefaults: defaults)
        XCTAssertEqual(settings.appMode, .standalone)

        // Entering a URL for the one-way Migrate to Server flow must not
        // silently change the mode; only the migration commit does.
        settings.apiUrl = "http://server.example:3001"
        XCTAssertEqual(settings.appMode, .standalone)
    }
}
