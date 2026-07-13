import SwiftUI

/// Pre-screen shown before Create New Task / New Article: choose to start
/// blank or from a template of the given target. Same sheet anatomy as the
/// status/target picker sheets (header + divider + row list).
struct TemplateChooserSheet: View {
    /// issues.template_target value to list ("task" / "article").
    let target: String
    let onBlank: () -> Void
    let onTemplate: (Template) -> Void
    let onDismiss: () -> Void

    @EnvironmentObject var dataSources: DataSourceProvider
    @State private var templates: [Template] = []
    @State private var isLoading = true

    private var blankLabel: String {
        target == "article" ? "Blank article" : "Blank task"
    }

    var body: some View {
        VStack(spacing: 0) {
            ModalHeader(title: "New", onDismiss: onDismiss)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Button(action: {
                        HapticManager.selection()
                        onBlank()
                    }) {
                        HStack {
                            Text(blankLabel)
                                .font(.system(size: 16))
                                .foregroundColor(.textPrimary)
                            Spacer()
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }
                    Divider().padding(.leading, 16)

                    if isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                    } else {
                        ForEach(templates) { template in
                            Button(action: {
                                HapticManager.selection()
                                onTemplate(template)
                            }) {
                                HStack {
                                    Text(template.title ?? "Template #\(template.id)")
                                        .font(.system(size: 16))
                                        .foregroundColor(.textPrimary)
                                        .lineLimit(1)
                                    Spacer()
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 14)
                            }
                            Divider().padding(.leading, 16)
                        }
                    }
                }
            }
        }
        .background(Color(.systemBackground))
        .task {
            do {
                let response = try await dataSources.templates.listTemplates(queryItems: [
                    URLQueryItem(name: "target", value: target)
                ])
                templates = response.data
            } catch {
                // Non-critical: the blank option still works.
            }
            isLoading = false
        }
    }
}
