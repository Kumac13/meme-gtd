import Foundation
import os

private let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "APIClient")

enum APIError: Error, LocalizedError {
    case noConfiguration
    case invalidURL
    case networkError(Error)
    case serverError(Int, String?)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .noConfiguration:
            return "API URL is not configured. Please set it in the app settings."
        case .invalidURL:
            return "Invalid API URL."
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message ?? "Unknown error")"
        case .decodingError(let error):
            return "Failed to parse response: \(error.localizedDescription)"
        }
    }
}

extension Notification.Name {
    /// Posted when an API request receives an HTTP response below status 500.
    nonisolated static let apiServerReachable = Notification.Name("APIClientServerReachable")

    /// A request returned 5xx. Probe health to determine server-wide availability.
    nonisolated static let apiRequestServerError = Notification.Name("APIRequestServerError")

    /// Health probe results determine server-wide availability.
    nonisolated static let apiHealthReady = Notification.Name("APIHealthReady")
    nonisolated static let apiHealthUnreachable = Notification.Name("APIHealthUnreachable")
    nonisolated static let apiHealthError = Notification.Name("APIHealthError")

    /// Posted when an API request fails at the transport level without an HTTP response.
    nonisolated static let apiServerUnreachable = Notification.Name("APIClientServerUnreachable")
}

class APIClient {
    static var shared: APIClient { APIClient(baseUrl: Settings.shared.effectiveApiUrl) }

    let baseUrl: String
    private let session: URLSession

    init(baseUrl: String, session: URLSession = .shared) {
        self.baseUrl = baseUrl
        self.session = session
    }

    // MARK: - Server reachability signal

    /// Announces whether the transport delivered an HTTP response, right
    /// where each request learns it. Offline detection is driven by these
    /// real request outcomes (Apple's guidance: judge connectivity from
    /// actual requests, not preflight checks); ConnectivityMonitor observes.
    private func noteServerReachable(_ reachable: Bool) {
        NotificationCenter.default.post(
            name: reachable ? .apiServerReachable : .apiServerUnreachable,
            object: baseUrl
        )
    }

    private func report(_ response: URLResponse) {
        guard let http = response as? HTTPURLResponse else { return }
        if http.statusCode >= 500 {
            NotificationCenter.default.post(name: .apiRequestServerError, object: baseUrl)
        } else {
            noteServerReachable(true)
        }
    }

    /// A cancelled request (screen navigated away, task cancelled) proves
    /// nothing about the server — it must not feed the unreachable signal.
    private func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        return (error as? URLError)?.code == .cancelled
    }

    /// Posts the unreachable signal for a transport failure, unless the
    /// failure was a cancellation.
    private func noteTransportFailure(_ error: Error) {
        guard !isCancellation(error) else { return }
        noteServerReachable(false)
    }

    /// Only a successful health response confirms recovery.
    func probeServerReachability() async -> Bool {
        guard let url = try? buildURL(path: "/api/health") else {
            // A URL that cannot be built means the server cannot be reached
            // as configured — the verdict must still flow through the
            // notifications, or ConnectivityMonitor never hears back.
            NotificationCenter.default.post(name: .apiHealthUnreachable, object: baseUrl)
            return false
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        // Same budget as get(): a slow-but-alive link (Tailscale
        // re-establishing) can need >5s, and a probe that times out on a
        // reachable server would wrongly confirm "unreachable". Genuine
        // outages fail transport-level in well under a second regardless.
        request.timeoutInterval = 15
        do {
            let (_, response) = try await session.data(for: request)
            let healthy = (response as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } ?? false
            if healthy { NotificationCenter.default.post(name: .apiHealthReady, object: baseUrl) }
            else { NotificationCenter.default.post(name: .apiHealthError, object: baseUrl) }
            return healthy
        } catch {
            if !isCancellation(error) { NotificationCenter.default.post(name: .apiHealthUnreachable, object: baseUrl) }
            return false
        }
    }

    // MARK: - Generic HTTP methods

    func get<T: Decodable>(
        path: String,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        let url = try buildURL(path: path, queryItems: queryItems)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        // Reads should fail fast: the default 60s timeout left screens blank
        // for minutes when the connection was re-establishing (e.g. Tailscale
        // after relaunch). Mutations and uploads keep the default.
        request.timeoutInterval = 15
        return try await execute(request)
    }

    func post<B: Encodable, T: Decodable>(
        path: String,
        body: B
    ) async throws -> T {
        let url = try buildURL(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await execute(request)
    }

    func postReturning<T: Decodable>(path: String) async throws -> T {
        let url = try buildURL(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        return try await execute(request)
    }

    /// POST a JSON body and return the raw response JSON as a pretty-printed
    /// string. Used by the "copy search results" feature where we want to
    /// place the server's JSON response directly on the clipboard without
    /// round-tripping through typed Swift structs.
    func postReturningJSONString<B: Encodable>(
        path: String,
        body: B
    ) async throws -> String {
        let url = try buildURL(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        // The transport call gets its own do/catch so that only genuine
        // transport failures post the unreachable signal — the JSON handling
        // below can throw too, but by then the server has already answered.
        let data: Data
        do {
            let (received, response) = try await session.data(for: request)
            report(response)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.serverError(0, "Invalid response")
            }
            guard (200...299).contains(httpResponse.statusCode) else {
                let message = String(data: received, encoding: .utf8)
                throw APIError.serverError(httpResponse.statusCode, message)
            }
            data = received
        } catch let error as APIError {
            throw error
        } catch {
            noteTransportFailure(error)
            throw APIError.networkError(error)
        }

        do {
            let object = try JSONSerialization.jsonObject(with: data, options: [])
            let prettyData = try JSONSerialization.data(
                withJSONObject: object,
                options: [.prettyPrinted, .sortedKeys]
            )
            guard let prettyString = String(data: prettyData, encoding: .utf8) else {
                throw APIError.decodingError(
                    NSError(
                        domain: "APIClient",
                        code: -1,
                        userInfo: [NSLocalizedDescriptionKey: "Failed to encode JSON as UTF-8"]
                    )
                )
            }
            return prettyString
        } catch let error as APIError {
            throw error
        } catch {
            // The server already answered; a JSON re-serialization failure is
            // a decoding problem, not a network one — misclassifying it as
            // networkError would send callers down the offline path.
            throw APIError.decodingError(error)
        }
    }

    func patch<B: Encodable, T: Decodable>(
        path: String,
        body: B
    ) async throws -> T {
        let url = try buildURL(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await execute(request)
    }

    func delete(path: String) async throws {
        let url = try buildURL(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        // Transport failures are wrapped in APIError.networkError like every
        // other method — OfflineFirstSupport.isNetworkError relies on that
        // to classify a delete against an unreachable server as offline.
        do {
            let (_, response) = try await session.data(for: request)
            report(response)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                throw APIError.serverError(code, nil)
            }
        } catch let error as APIError {
            throw error
        } catch {
            noteTransportFailure(error)
            // A cancellation proves nothing about the server; rethrow it raw
            // so OfflineFirstSupport.isNetworkError does not classify a
            // cancelled delete as "server unreachable".
            if isCancellation(error) { throw error }
            throw APIError.networkError(error)
        }
    }

    // MARK: - URL building

    private func buildURL(path: String, queryItems: [URLQueryItem]? = nil) throws -> URL {
        logger.info("buildURL: baseUrl=\(self.baseUrl), path=\(path)")
        guard var components = URLComponents(string: "\(baseUrl)\(path)") else {
            throw APIError.invalidURL
        }
        if let queryItems = queryItems, !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        guard let url = components.url else {
            throw APIError.invalidURL
        }
        return url
    }

    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        logger.info("execute: \(request.httpMethod ?? "?") \(request.url?.absoluteString ?? "nil")")
        do {
            let (data, response) = try await session.data(for: request)
            report(response)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.serverError(0, "Invalid response")
            }
            logger.info("execute: status=\(httpResponse.statusCode)")
            guard (200...299).contains(httpResponse.statusCode) else {
                let message = String(data: data, encoding: .utf8)
                throw APIError.serverError(httpResponse.statusCode, message)
            }
            do {
                return try JSONDecoder().decode(T.self, from: data)
            } catch {
                logger.error("decode error: \(error.localizedDescription)")
                throw APIError.decodingError(error)
            }
        } catch let error as APIError {
            throw error
        } catch {
            logger.error("network error: \(error.localizedDescription)")
            noteTransportFailure(error)
            throw APIError.networkError(error)
        }
    }

    // MARK: - Multipart upload

    struct AttachmentResponse: Decodable {
        let id: String
        let filename: String
        let markdownRef: String
        let mimeType: String
        let size: Int
    }

    func uploadImage(imageData: Data, filename: String, mimeType: String) async throws -> AttachmentResponse {
        let url = try buildURL(path: "/api/attachments")
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        return try await execute(request)
    }

    // MARK: - Legacy methods (Article support)

    func saveArticle(_ request: CreateArticleRequest) async throws -> ArticleResponse {
        return try await post(path: "/api/articles", body: request)
    }

    func testConnection() async -> Bool {
        guard let url = URL(string: "\(baseUrl)/api/articles") else {
            return false
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 5
        do {
            let (_, response) = try await session.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                return httpResponse.statusCode == 200
            }
            return false
        } catch {
            return false
        }
    }
}
