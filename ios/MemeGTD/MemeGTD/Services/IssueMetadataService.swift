import Foundation

struct IssueMetadataOptions {
    let labels: [IssueLabel]?
    let associatedProjects: [Project]?
    let allProjects: [Project]?
}

struct IssueProjectOptions {
    let associated: [Project]?
    let all: [Project]?
}

/// Detail画面で共通するLabel / Project候補取得と差分適用。
/// resource本体、store、activityの再取得は各ViewModelが担当する。
@MainActor
struct IssueMetadataService {
    typealias LoadLabels = () async throws -> [IssueLabel]
    typealias LoadProjects = () async throws -> [Project]
    typealias AssignLabel = (Int) async throws -> Void
    typealias RemoveLabel = (Int) async throws -> Void
    typealias AddProject = (Int) async throws -> Void
    typealias RemoveProject = (Int) async throws -> Void

    private let loadLabelsOperation: LoadLabels
    private let loadAssociatedProjectsOperation: LoadProjects
    private let loadAllProjectsOperation: LoadProjects
    private let assignLabelOperation: AssignLabel
    private let removeLabelOperation: RemoveLabel
    private let addProjectOperation: AddProject
    private let removeProjectOperation: RemoveProject

    init(issueId: Int, dataSources: DataSourceProvider) {
        self.init(
            loadLabels: { try await dataSources.labels.listLabels() },
            loadAssociatedProjects: {
                try await dataSources.projects.listIssueProjects(issueId: issueId)
            },
            loadAllProjects: { try await dataSources.projects.listProjects() },
            assignLabel: { labelId in
                let _: AssignLabelResponse = try await dataSources.labels.assignLabel(
                    issueId: issueId,
                    AssignLabelRequest(labelId: labelId)
                )
            },
            removeLabel: { labelId in
                try await dataSources.labels.removeLabel(issueId: issueId, labelId: labelId)
            },
            addProject: { projectId in
                let _: ProjectItem = try await dataSources.projects.addProjectItem(
                    projectId: projectId,
                    AddProjectItemRequest(issueId: issueId)
                )
            },
            removeProject: { projectId in
                try await dataSources.projects.removeProjectItem(
                    projectId: projectId,
                    issueId: issueId
                )
            }
        )
    }

    init(
        loadLabels: @escaping LoadLabels,
        loadAssociatedProjects: @escaping LoadProjects,
        loadAllProjects: @escaping LoadProjects,
        assignLabel: @escaping AssignLabel,
        removeLabel: @escaping RemoveLabel,
        addProject: @escaping AddProject,
        removeProject: @escaping RemoveProject
    ) {
        self.loadLabelsOperation = loadLabels
        self.loadAssociatedProjectsOperation = loadAssociatedProjects
        self.loadAllProjectsOperation = loadAllProjects
        self.assignLabelOperation = assignLabel
        self.removeLabelOperation = removeLabel
        self.addProjectOperation = addProject
        self.removeProjectOperation = removeProject
    }

    func loadOptions() async -> IssueMetadataOptions {
        async let labels = try? loadLabelsOperation()
        async let associatedProjects = try? loadAssociatedProjectsOperation()
        async let allProjects = try? loadAllProjectsOperation()
        return await IssueMetadataOptions(
            labels: labels,
            associatedProjects: associatedProjects,
            allProjects: allProjects
        )
    }

    func loadProjectOptions() async -> IssueProjectOptions {
        async let associated = try? loadAssociatedProjectsOperation()
        async let all = try? loadAllProjectsOperation()
        return await IssueProjectOptions(associated: associated, all: all)
    }

    func reconciling(_ labels: [IssueLabel], with newLabel: IssueLabel) -> [IssueLabel] {
        guard !labels.contains(where: { $0.id == newLabel.id || $0.name == newLabel.name }) else {
            return labels
        }
        return labels + [newLabel]
    }

    func applyLabels(
        selectedNames: Set<String>,
        currentNames: Set<String>,
        allLabels: [IssueLabel]
    ) async throws {
        let labelsByName = Dictionary(uniqueKeysWithValues: allLabels.map { ($0.name, $0) })
        var operations: [() async throws -> Void] = []

        for name in selectedNames.subtracting(currentNames).sorted() {
            guard let label = labelsByName[name] else { continue }
            operations.append { try await assignLabelOperation(label.id) }
        }
        for name in currentNames.subtracting(selectedNames).sorted() {
            guard let label = labelsByName[name] else { continue }
            operations.append { try await removeLabelOperation(label.id) }
        }

        try await performAll(operations)
    }

    func applyProjects(selectedIds: Set<Int>, currentIds: Set<Int>) async throws {
        var operations: [() async throws -> Void] = []

        for projectId in selectedIds.subtracting(currentIds).sorted() {
            operations.append { try await addProjectOperation(projectId) }
        }
        for projectId in currentIds.subtracting(selectedIds).sorted() {
            operations.append { try await removeProjectOperation(projectId) }
        }

        try await performAll(operations)
    }

    private func performAll(_ operations: [() async throws -> Void]) async throws {
        var firstError: Error?
        for operation in operations {
            do {
                try await operation()
            } catch {
                if firstError == nil {
                    firstError = error
                }
            }
        }
        if let firstError {
            throw firstError
        }
    }
}
