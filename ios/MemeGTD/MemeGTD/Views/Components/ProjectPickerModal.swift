import SwiftUI

struct ProjectPickerModal: View {
    let allProjects: [Project]
    @Binding var selectedIds: Set<Int>
    let onDismiss: () -> Void
    let onConfirm: (Set<Int>) -> Void

    @State private var searchText = ""

    private var filteredProjects: [Project] {
        if searchText.isEmpty { return allProjects }
        let query = searchText.lowercased()
        return allProjects.filter { $0.name.lowercased().contains(query) }
    }

    var body: some View {
        VStack(spacing: 0) {
            PickerModalHeader(
                title: "Projects",
                onDismiss: onDismiss,
                onConfirm: { onConfirm(selectedIds) }
            )

            Divider()

            ZStack(alignment: .bottom) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
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
