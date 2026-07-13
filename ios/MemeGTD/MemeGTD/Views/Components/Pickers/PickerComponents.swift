import SwiftUI

struct PickerSelectionIndicator: View {
    let isSelected: Bool
    var unselectedSystemName: String = "plus.circle"

    var body: some View {
        Image(systemName: isSelected ? "checkmark.circle.fill" : unselectedSystemName)
            .font(.system(size: 22))
            .foregroundColor(isSelected ? .accent : Color(.systemGray3))
    }
}

struct PickerSectionHeader: View {
    let title: String

    var body: some View {
        HStack {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.textPrimary)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 4)
    }
}

struct AddExternalURLRow: View {
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.impact(.light)
            action()
        }) {
            HStack(spacing: 8) {
                Image(systemName: "link.badge.plus")
                    .font(.system(size: 15))
                Text("Add External URL")
                    .font(.system(size: 15))
                Spacer()
            }
            .foregroundColor(.accent)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }
}

struct IssuePickerItemSummary: View {
    let item: IssuePickerItem

    var body: some View {
        IssueTypeBadge(type: item.type)

        Text(item.title)
            .font(.system(size: 15, weight: .medium))
            .foregroundColor(.textPrimary)
            .lineLimit(1)

        if let status = item.status {
            Text(status.capitalized)
                .font(.system(size: 11))
                .foregroundColor(.accentDark)
        }
    }
}

struct ExternalURLBadge: View {
    var body: some View {
        Text("URL")
            .font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .frame(width: IssueTypeBadge.defaultWidth)
            .background(Color.accent.opacity(0.15))
            .foregroundColor(.accentDark)
            .clipShape(Capsule())
    }
}

struct ExternalURLForm: View {
    @Binding var urlText: String
    @Binding var titleText: String
    var isSubmitting: Bool = false
    let onBack: () -> Void
    let onSubmit: (_ url: String, _ title: String?) -> Void

    private var trimmedURL: String {
        urlText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canSubmit: Bool {
        !trimmedURL.isEmpty && URL(string: trimmedURL) != nil && !isSubmitting
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: {
                    HapticManager.impact(.light)
                    onBack()
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 14, weight: .medium))
                        Text("Back")
                            .font(.system(size: 15))
                    }
                    .foregroundColor(.accent)
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("URL")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.textSecondary)
                    TextField("https://example.com", text: $urlText)
                        .font(.system(size: 15))
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Title (optional)")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.textSecondary)
                    TextField("Link title", text: $titleText)
                        .font(.system(size: 15))
                        .textFieldStyle(.roundedBorder)
                }

                Button(action: {
                    guard canSubmit else { return }
                    let title = titleText.trimmingCharacters(in: .whitespacesAndNewlines)
                    onSubmit(trimmedURL, title.isEmpty ? nil : title)
                }) {
                    HStack {
                        if isSubmitting {
                            ProgressView().tint(.white)
                        }
                        Text("Add")
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(canSubmit ? Color.accent : Color(.systemGray4))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(!canSubmit)
            }
            .padding(16)

            Spacer()
        }
    }
}
