import SwiftUI

struct CreateArticleModal: View {
    let template: Template?
    let onCreated: (Article) -> Void
    let onDismiss: () -> Void

    @EnvironmentObject var dataSources: DataSourceProvider
    @State private var title = ""
    @State private var bodyMd = ""
    @State private var isSubmitting = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(Color(.tertiaryLabel))
                }
                Spacer()
                Text("New Article").font(.system(size: 17, weight: .semibold))
                Spacer()
                Button("Create") { submit() }
                    .font(.system(size: 17, weight: .semibold))
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSubmitting)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Title").font(.system(size: 13, weight: .medium)).foregroundColor(.textSecondary)
                        AutoFocusTextField(placeholder: "Article title...", text: $title)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Body").font(.system(size: 13, weight: .medium)).foregroundColor(.textSecondary)
                        TextEditor(text: $bodyMd)
                            .font(.system(size: 15))
                            .frame(minHeight: 220)
                            .scrollContentBackground(.hidden)
                    }
                    if let error {
                        Text(error).font(.footnote).foregroundColor(.red)
                    }
                }
                .padding(16)
            }
        }
        .background(Color(.systemBackground))
        .onAppear { bodyMd = template?.bodyMd ?? "" }
    }

    private func submit() {
        isSubmitting = true
        Task {
            do {
                let article = try await dataSources.articles.createArticle(
                    CreateManualArticleRequest(
                        title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                        bodyMd: bodyMd,
                        labels: template?.labels
                    )
                )
                for projectId in template?.projectIds ?? [] {
                    _ = try await dataSources.projects.addProjectItem(
                        projectId: projectId,
                        AddProjectItemRequest(issueId: article.id)
                    )
                }
                onCreated(article)
            } catch {
                self.error = error.localizedDescription
                isSubmitting = false
            }
        }
    }
}
