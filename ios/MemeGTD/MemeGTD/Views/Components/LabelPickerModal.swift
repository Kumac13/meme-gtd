import SwiftUI

struct LabelPickerModal: View {
    let allLabels: [IssueLabel]
    @Binding var selectedNames: Set<String>
    let onDismiss: () -> Void
    var showClear: Bool = false
    var countFor: (IssueLabel) -> Int

    @State private var searchText = ""

    private var filteredLabels: [IssueLabel] {
        if searchText.isEmpty { return allLabels }
        let query = searchText.lowercased()
        return allLabels.filter { $0.name.lowercased().contains(query) }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: { HapticManager.impact(.light); onDismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(Color(.tertiaryLabel))
                }
                Spacer()
                Text("Labels")
                    .font(.system(size: 17, weight: .semibold))
                Spacer()
                if showClear {
                    Button(action: {
                        HapticManager.impact(.light)
                        selectedNames.removeAll()
                    }) {
                        Text("Clear")
                            .font(.system(size: 16))
                            .foregroundColor(selectedNames.isEmpty ? Color(.systemGray3) : .accent)
                    }
                    .disabled(selectedNames.isEmpty)
                } else {
                    // Invisible spacer to keep title centered
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
                        ForEach(filteredLabels) { label in
                            let isSelected = selectedNames.contains(label.name)
                            Button(action: {
                                HapticManager.impact(.light)
                                if isSelected {
                                    selectedNames.remove(label.name)
                                } else {
                                    selectedNames.insert(label.name)
                                }
                            }) {
                                HStack {
                                    Text(label.name)
                                        .font(.system(size: 13, weight: .medium))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(LabelColorHelper.bgColor(for: label.name))
                                        .foregroundColor(LabelColorHelper.textColor(for: label.name))
                                        .clipShape(Capsule())

                                    Spacer()

                                    Text("\(countFor(label))")
                                        .font(.system(size: 13))
                                        .foregroundColor(Color(.secondaryLabel))
                                        .padding(.trailing, 4)

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
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                            }
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
}
