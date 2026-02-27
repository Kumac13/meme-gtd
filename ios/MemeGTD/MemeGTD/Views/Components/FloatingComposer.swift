import SwiftUI

struct FloatingComposer: View {
    @Binding var text: String
    let placeholder: String
    var disabled: Bool = false
    var submitting: Bool = false
    let onSubmit: () -> Void

    @FocusState private var isFocused: Bool

    private var canSubmit: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !disabled && !submitting
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // Text field
            TextField(placeholder, text: $text, axis: .vertical)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
                .padding(.leading, 16)
                .padding(.trailing, 46)
                .padding(.top, 13)
                .padding(.bottom, 10)
                .focused($isFocused)
                .disabled(disabled || submitting)
                .onSubmit {
                    if canSubmit { onSubmit() }
                }

            // Send button
            Button(action: {
                if canSubmit { onSubmit() }
            }) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 28, height: 28)
                    .background(canSubmit ? Color.accent : Color(.systemGray4))
                    .clipShape(Circle())
            }
            .disabled(!canSubmit)
            .padding(.trailing, 8)
            .padding(.bottom, 7)
        }
        // Independent surface: background + rounded corners + shadow
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(Color(.separator).opacity(0.4), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: 2)
        .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
    }
}
