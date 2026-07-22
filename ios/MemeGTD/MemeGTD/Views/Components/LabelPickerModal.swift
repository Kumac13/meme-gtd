import SwiftUI

struct LabelPickerModal: View {
    let allLabels: [IssueLabel]
    @Binding var selectedNames: Set<String>
    let onDismiss: () -> Void
    var onConfirm: ((Set<String>) -> Void)? = nil
    var showClear: Bool = false
    var countFor: (IssueLabel) -> Int
    var onLabelCreated: ((IssueLabel) -> Void)? = nil

    @State private var searchText = ""
    @State private var showCreateSheet = false
    @State private var newLabelName = ""

    private var trimmedSearchText: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var filteredLabels: [IssueLabel] {
        if searchText.isEmpty { return allLabels }
        let query = searchText.lowercased()
        return allLabels.filter { $0.name.lowercased().contains(query) }
    }

    var body: some View {
        MultiSelectPickerShell(
            title: "Labels",
            onDismiss: onDismiss,
            trailingAction: showClear
                    ? .clear(isEnabled: !selectedNames.isEmpty, action: {
                        HapticManager.impact(.light)
                        selectedNames.removeAll()
                    })
                    : onConfirm.map { confirm in
                        .confirm(isEnabled: true, action: { confirm(selectedNames) })
                    } ?? .placeholder,
            searchText: $searchText
        ) {
                        Button(action: {
                            HapticManager.impact(.light)
                            newLabelName = trimmedSearchText
                            showCreateSheet = true
                        }) {
                            HStack(spacing: 8) {
                                Image(systemName: "tag.badge.plus")
                                    .font(.system(size: 15))
                                    .foregroundColor(.accent)
                                Text(trimmedSearchText.isEmpty ? "Add Label" : "Add Label \"\(trimmedSearchText)\"")
                                    .font(.system(size: 15))
                                    .foregroundColor(.accent)
                                Spacer()
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                        }

                        Divider().padding(.leading, 16)

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

                                    PickerSelectionIndicator(isSelected: isSelected)
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                            }
                            Divider().padding(.leading, 16)
                        }

        }
        .sheet(isPresented: $showCreateSheet) {
            CreateLabelSheet(initialName: newLabelName) { newLabel in
                onLabelCreated?(newLabel)
            }
            .presentationDetents([.medium])
        }
    }
}

struct CreateLabelSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var dataSources: DataSourceProvider
    @State private var name: String
    @State private var description: String = ""
    @State private var isSaving = false
    @State private var error: String? = nil

    let onCreated: (IssueLabel) -> Void

    init(initialName: String, onCreated: @escaping (IssueLabel) -> Void) {
        _name = State(initialValue: initialName)
        self.onCreated = onCreated
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Label Name", text: $name)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    TextField("Description (Optional)", text: $description)
                } header: {
                    Text("Label Info")
                } footer: {
                    if let error = error {
                        Text(error)
                            .foregroundColor(.red)
                            .font(.system(size: 13))
                            .padding(.top, 4)
                    }
                }
            }
            .navigationTitle("New Label")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        createLabel()
                    }
                    .bold()
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
        }
    }

    private func createLabel() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }

        isSaving = true
        error = nil

        Task {
            do {
                let req = CreateLabelRequest(name: trimmedName, description: description.isEmpty ? nil : description)
                let label: IssueLabel = try await dataSources.labels.createLabel(req)

                HapticManager.notification(.success)
                onCreated(label)
                dismiss()
            } catch {
                HapticManager.notification(.error)
                self.error = error.localizedDescription
                isSaving = false
            }
        }
    }
}
