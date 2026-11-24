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

    func listLabels() async throws -> [IssueLabel] {
        try await client.get(path: "/api/labels")
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
