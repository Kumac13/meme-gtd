import Foundation

/// Data access seam for templates (issues with type='template').
protocol TemplateDataSource {
    func listTemplates(queryItems: [URLQueryItem]) async throws -> TemplateListResponse
    func getTemplate(id: Int) async throws -> Template
    func createTemplate(_ request: CreateTemplateRequest) async throws -> Template
    func updateTemplate(id: Int, _ request: UpdateTemplateRequest) async throws -> Template
    func deleteTemplate(id: Int) async throws
}

/// Server-backed implementation: a thin wrapper around `APIClient`.
struct RemoteTemplateDataSource: TemplateDataSource {
    func listTemplates(queryItems: [URLQueryItem]) async throws -> TemplateListResponse {
        try await APIClient.shared.get(path: "/api/templates", queryItems: queryItems)
    }

    func getTemplate(id: Int) async throws -> Template {
        try await APIClient.shared.get(path: "/api/templates/\(id)")
    }

    func createTemplate(_ request: CreateTemplateRequest) async throws -> Template {
        try await APIClient.shared.post(path: "/api/templates", body: request)
    }

    func updateTemplate(id: Int, _ request: UpdateTemplateRequest) async throws -> Template {
        try await APIClient.shared.patch(path: "/api/templates/\(id)", body: request)
    }

    func deleteTemplate(id: Int) async throws {
        try await APIClient.shared.delete(path: "/api/templates/\(id)")
    }
}

/// Standalone stand-in (same precedent as `EmptyProjectDataSource`): templates
/// are not supported without a server yet, so reads return empty and writes
/// fail with a clear English message.
struct EmptyTemplateDataSource: TemplateDataSource {
    private var unsupported: Error {
        NSError(
            domain: "MemeGTD",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "Templates are not available in Standalone mode yet."]
        )
    }

    func listTemplates(queryItems _: [URLQueryItem]) async throws -> TemplateListResponse {
        TemplateListResponse(data: [], total: 0, limit: 0, offset: 0)
    }

    func getTemplate(id _: Int) async throws -> Template { throw unsupported }
    func createTemplate(_: CreateTemplateRequest) async throws -> Template { throw unsupported }
    func updateTemplate(id _: Int, _: UpdateTemplateRequest) async throws -> Template { throw unsupported }
    func deleteTemplate(id _: Int) async throws { throw unsupported }
}
