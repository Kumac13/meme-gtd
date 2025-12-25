import Foundation

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

    func saveArticle(_ request: CreateArticleRequest) async throws -> ArticleResponse {
        let baseUrl = Settings.shared.effectiveApiUrl

        guard let url = URL(string: "\(baseUrl)/api/articles") else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let encoder = JSONEncoder()
        urlRequest.httpBody = try encoder.encode(request)

        do {
            let (data, response) = try await URLSession.shared.data(for: urlRequest)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.serverError(0, "Invalid response")
            }

            guard httpResponse.statusCode == 201 else {
                let message = String(data: data, encoding: .utf8)
                throw APIError.serverError(httpResponse.statusCode, message)
            }

            let decoder = JSONDecoder()
            do {
                return try decoder.decode(ArticleResponse.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }

    // Test connection to the API
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
