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
    func listLabels() async throws -> [IssueLabel] {
        try await APIClient.shared.get(path: "/api/labels")
    }

    func createLabel(_ request: CreateLabelRequest) async throws -> IssueLabel {
        try await APIClient.shared.post(path: "/api/labels", body: request)
    }

    func assignLabel(issueId: Int, _ request: AssignLabelRequest) async throws -> AssignLabelResponse {
        try await APIClient.shared.post(path: "/api/issues/\(issueId)/labels", body: request)
    }

    func removeLabel(issueId: Int, labelId: Int) async throws {
        try await APIClient.shared.delete(path: "/api/issues/\(issueId)/labels/\(labelId)")
    }
}
