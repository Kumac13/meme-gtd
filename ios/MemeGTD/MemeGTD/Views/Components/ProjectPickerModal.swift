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
        MultiSelectPickerShell(
            title: "Projects",
            onDismiss: onDismiss,
            trailingAction: showClear
                    ? .clear(isEnabled: hasAnySelection, action: {
                        HapticManager.impact(.light)
                        selectedIds.removeAll()
                        includeNoProject = false
                    })
                    : onConfirm.map { confirm in
                        .confirm(isEnabled: true, action: { confirm(selectedIds) })
                    } ?? .placeholder,
            searchText: $searchText
        ) {
                        if showClear {
                            noProjectRow
                            Divider().padding(.leading, 16)
                        }

                        ForEach(filteredProjects) { project in
                            let isSelected = selectedIds.contains(project.id)
                            projectRow(project, isSelected: isSelected)
                            Divider().padding(.leading, 16)
                        }

        }
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
                PickerSelectionIndicator(isSelected: includeNoProject)
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
                PickerSelectionIndicator(isSelected: isSelected)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}
