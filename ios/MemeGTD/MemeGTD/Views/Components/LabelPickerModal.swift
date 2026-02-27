import SwiftUI

struct LabelPickerModal: View {
    let allLabels: [IssueLabel]
    @Binding var selectedNames: Set<String>
    let onDismiss: () -> Void
    let onConfirm: (Set<String>) -> Void

    @State private var searchText = ""

    private var filteredLabels: [IssueLabel] {
        if searchText.isEmpty { return allLabels }
        let query = searchText.lowercased()
        return allLabels.filter { $0.name.lowercased().contains(query) }
    }

    var body: some View {
        VStack(spacing: 0) {
            PickerModalHeader(
                title: "Labels",
                onDismiss: onDismiss,
                onConfirm: { onConfirm(selectedNames) }
            )

            Divider()

            ZStack(alignment: .bottom) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(filteredLabels) { label in
                            let isSelected = selectedNames.contains(label.name)
                            labelRow(label, isSelected: isSelected)
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

    private func labelRow(_ label: IssueLabel, isSelected: Bool) -> some View {
        HStack {
            // Color-coded capsule (matches Web UI LabelBadge)
            Text(label.name)
                .font(.system(size: 13, weight: .medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(LabelColorHelper.bgColor(for: label.name))
                .foregroundColor(LabelColorHelper.textColor(for: label.name))
                .clipShape(Capsule())

            Spacer()

            Button(action: {
                HapticManager.impact(.light)
                if isSelected {
                    selectedNames.remove(label.name)
                } else {
                    selectedNames.insert(label.name)
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
        .padding(.vertical, 10)
    }

}
