import SwiftUI

struct CreateArticleModal: View {
    let template: Template?
    let onCreated: (Article) -> Void
    let onDismiss: () -> Void

    @EnvironmentObject var dataSources: DataSourceProvider

    @State private var title = ""
    @State private var bodyMd: String
    @State private var selectedLabelNames: Set<String>
    @State private var selectedProjectIds: Set<Int>
    @State private var allLabels: [IssueLabel] = []
    @State private var allProjects: [Project] = []
    @State private var isSubmitting = false
    @State private var error: String?

    init(
        template: Template?,
        initialLabels: [IssueLabel] = [],
        initialProjects: [Project] = [],
        onCreated: @escaping (Article) -> Void,
        onDismiss: @escaping () -> Void
    ) {
        self.template = template
        self.onCreated = onCreated
        self.onDismiss = onDismiss
        self._bodyMd = State(initialValue: template?.bodyMd ?? "")
        self._selectedLabelNames = State(initialValue: Set(template?.labels ?? []))
        self._selectedProjectIds = State(initialValue: Set(template?.projectIds ?? []))
        self._allLabels = State(initialValue: initialLabels)
        self._allProjects = State(initialValue: initialProjects)
    }

    var body: some View {
        VStack(spacing: 0) {
            header

            Divider()

            fullForm
        }
        .background(Color(.systemBackground))
    }

    // MARK: - Header

    private var header: some View {
        CreateIssueModalHeader(
            title: "New Article",
            isSubmitting: isSubmitting,
            isCreateDisabled: title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            onDismiss: onDismiss,
            onCreate: submit
        )
    }

    // MARK: - Full Form

    private var fullForm: some View {
        ScrollView {
            VStack(spacing: 0) {
                CreateIssueTextFields(
                    titlePlaceholder: "Article title...",
                    title: $title,
                    bodyMd: $bodyMd
                )

                Divider().padding(.leading, 16)

                CreateIssueMetadataSection(
                    allLabels: $allLabels,
                    selectedLabelNames: $selectedLabelNames,
                    allProjects: $allProjects,
                    selectedProjectIds: $selectedProjectIds,
                    labelCount: { $0.articleCount }
                )

                if let error {
                    CreateIssueErrorBanner(message: error)
                }

                Color.clear.frame(height: 40)
            }
        }
        .scrollDismissesKeyboard(.immediately)
    }

    private func submit() {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else { return }

        isSubmitting = true
        error = nil

        Task {
            do {
                let article = try await dataSources.articles.createArticle(
                    CreateManualArticleRequest(
                        title: trimmedTitle,
                        bodyMd: bodyMd,
                        labels: selectedLabelNames.isEmpty ? nil : Array(selectedLabelNames).sorted()
                    )
                )

                let dataSources = dataSources
                await withTaskGroup(of: Void.self) { group in
                    for projectId in selectedProjectIds {
                        group.addTask {
                            let _: ProjectItem? = try? await dataSources.projects.addProjectItem(
                                projectId: projectId,
                                AddProjectItemRequest(issueId: article.id)
                            )
                        }
                    }
                }

                HapticManager.notification(.success)
                isSubmitting = false
                onCreated(article)
            } catch {
                self.error = error.localizedDescription
                HapticManager.notification(.error)
                isSubmitting = false
            }
        }
    }
}
