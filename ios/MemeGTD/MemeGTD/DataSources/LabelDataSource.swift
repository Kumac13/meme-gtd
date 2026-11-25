import Foundation

/// Data access seam for labels and label assignment to issues.
protocol LabelDataSource {
    func listLabels() async throws -> [IssueLabel]
    func createLabel(_ request: CreateLabelRequest) async throws -> IssueLabel
    func assignLabel(issueId: Int, _ request: AssignLabelRequest) async throws -> AssignLabelResponse
    func removeLabel(issueId: Int, labelId: Int) async throws
}

/// Server-backed implementation: a thin wrapper around `APIClient`.
struct RemoteLabelDataSource: LabelDataSource {
    var client = APIClient.shared
    var localFallback: LocalLabelDataSource?

    func listLabels() async throws -> [IssueLabel] {
        do {
            return try await client.get(path: "/api/labels")
        } catch where OfflineFirstSupport.isNetworkError(error) {
            guard let localFallback else { throw error }
            return try await localFallback.listLabels()
        }
    }

    func createLabel(_ request: CreateLabelRequest) async throws -> IssueLabel {
        try await client.post(path: "/api/labels", body: request)
    }

    func assignLabel(issueId: Int, _ request: AssignLabelRequest) async throws -> AssignLabelResponse {
        try await client.post(path: "/api/issues/\(issueId)/labels", body: request)
    }

    func removeLabel(issueId: Int, labelId: Int) async throws {
        try await client.delete(path: "/api/issues/\(issueId)/labels/\(labelId)")
    }
}
