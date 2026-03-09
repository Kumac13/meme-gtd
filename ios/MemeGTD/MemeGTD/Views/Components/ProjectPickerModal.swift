import SwiftUI

struct ProjectPickerModal: View {
    let allProjects: [Project]
    @Binding var selectedIds: Set<Int>
    let onDismiss: () -> Void
    var onConfirm: ((Set<Int>) -> Void)? = nil
    var showClear: Bool = false
    @Binding var includeNoProject: Bool

    @State private var searchText = ""

    private var filteredProjects: [Project] {
        if searchText.isEmpty { return allProjects }
        let query = searchText.lowercased()
        return allProjects.filter { $0.name.lowercased().contains(query) }
    }

    private var hasAnySelection: Bool {
        !selectedIds.isEmpty || includeNoProject
    }

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
                Text("Projects")
                    .font(.system(size: 17, weight: .semibold))
                Spacer()
                if showClear {
                    Button(action: {
                        HapticManager.impact(.light)
                        selectedIds.removeAll()
                        includeNoProject = false
                    }) {
                        Text("Clear")
                            .font(.system(size: 16))
                            .foregroundColor(hasAnySelection ? .accent : Color(.systemGray3))
                    }
                    .disabled(!hasAnySelection)
                } else if let onConfirm = onConfirm {
                    Button(action: { onConfirm(selectedIds) }) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 28))
                            .foregroundColor(.accent)
                    }
                } else {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .hidden()
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            ZStack(alignment: .bottom) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        if showClear {
                            noProjectRow
                            Divider().padding(.leading, 16)
                        }

                        ForEach(filteredProjects) { project in
                            let isSelected = selectedIds.contains(project.id)
                            projectRow(project, isSelected: isSelected)
                            Divider().padding(.leading, 16)
                        }

                        Color.clear.frame(height: 70)
                    }
                }

                PickerSearchBar(text: $searchText, placeholder: "Search")
            }
        }
        .background(Color(.systemBackground))
    }

    private var noProjectRow: some View {
        HStack {
            Text("No Project")
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.textSecondary)
                .italic()

            Spacer()

            Button(action: {
                HapticManager.impact(.light)
                includeNoProject.toggle()
            }) {
                if includeNoProject {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.accent)
                } else {
                    Image(systemName: "plus.circle")
                        .font(.system(size: 22))
                        .foregroundColor(Color(.systemGray3))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private func projectRow(_ project: Project, isSelected: Bool) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(project.name)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(.textPrimary)

                Text(project.status.capitalized)
                    .font(.system(size: 11))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color(.systemGray5))
                    .cornerRadius(4)
                    .foregroundColor(.textSecondary)
            }

            Spacer()

            Button(action: {
                HapticManager.impact(.light)
                if isSelected {
                    selectedIds.remove(project.id)
                } else {
                    selectedIds.insert(project.id)
                }
            }) {
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.accent)
                } else {
                    Image(systemName: "plus.circle")
                        .font(.system(size: 22))
                        .foregroundColor(Color(.systemGray3))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}
