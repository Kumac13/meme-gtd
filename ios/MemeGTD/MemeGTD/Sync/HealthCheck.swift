import Foundation
import os

/// Pings `/api/health` to confirm the API server is actually reachable, not
/// just the wider network. Required because the iOS app talks to a
/// home-network server through Tailscale; you can have full Wi-Fi/cellular
/// and still not reach the server (VPN down, server off).
struct HealthCheck {
    private static let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "HealthCheck")

    /// Returns true if the server answered 200 within `timeout` seconds.
    /// Any other status (including network errors) is treated as offline so
    /// callers don't have to spell out every failure mode.
    static func probe(timeout: TimeInterval = 3) async -> Bool {
        let baseUrl = Settings.shared.effectiveApiUrl
        guard let url = URL(string: "\(baseUrl)/api/health") else {
            return false
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = timeout
        request.cachePolicy = .reloadIgnoringLocalCacheData

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return false }
            let ok = http.statusCode == 200
            if !ok {
                logger.debug("health probe status \(http.statusCode)")
            }
            return ok
        } catch {
            logger.debug("health probe error \(error.localizedDescription)")
            return false
        }
    }
}
