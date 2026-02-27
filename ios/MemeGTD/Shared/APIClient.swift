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

class APIClient {
    static let shared = APIClient()

    private init() {}

    // MARK: - Generic HTTP methods

    func get<T: Decodable>(
        path: String,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        let url = try buildURL(path: path, queryItems: queryItems)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
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
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw APIError.serverError(code, nil)
        }
    }

    // MARK: - URL building

    private func buildURL(path: String, queryItems: [URLQueryItem]? = nil) throws -> URL {
        let baseUrl = Settings.shared.effectiveApiUrl
        logger.info("buildURL: baseUrl=\(baseUrl), path=\(path)")
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
            let (data, response) = try await URLSession.shared.data(for: request)
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
            throw APIError.networkError(error)
        }
    }

    // MARK: - Legacy methods (Article support)

    func saveArticle(_ request: CreateArticleRequest) async throws -> ArticleResponse {
        return try await post(path: "/api/articles", body: request)
    }

    func testConnection() async -> Bool {
        let baseUrl = Settings.shared.effectiveApiUrl
        guard let url = URL(string: "\(baseUrl)/api/articles") else {
            return false
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 5
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                return httpResponse.statusCode == 200
            }
            return false
        } catch {
            return false
        }
    }
}
