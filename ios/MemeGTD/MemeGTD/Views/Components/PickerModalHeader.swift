import SwiftUI

/// Shared header bar for picker modals (GitHub Issue style).
/// Layout: [X dismiss] [Title] [✓ confirm (blue circle)]
struct PickerModalHeader: View {
    let title: String
    let onDismiss: () -> Void
    let onConfirm: () -> Void

    var body: some View {
        HStack {
            Button(action: onDismiss) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 28))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundColor(Color(.tertiaryLabel))
            }

            Spacer()

            Text(title)
                .font(.system(size: 17, weight: .semibold))

            Spacer()

            Button(action: onConfirm) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 28))
                    .foregroundColor(.accent)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

/// Fixed bottom search bar for picker modals.
struct PickerSearchBar: View {
    @Binding var text: String
    let placeholder: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15))
                .foregroundColor(Color(.systemGray))

            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 15))
                .tint(Color.accent)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }
}
