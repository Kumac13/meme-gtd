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
        VStack(spacing: 0) {
            Divider()
            HStack(alignment: .bottom, spacing: 8) {
                TextField(placeholder, text: $text, axis: .vertical)
                    .lineLimit(1...5)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .focused($isFocused)
                    .disabled(disabled || submitting)
                    .onSubmit {
                        if canSubmit {
                            onSubmit()
                        }
                    }

                Button(action: {
                    if canSubmit {
                        onSubmit()
                    }
                }) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(canSubmit ? .accent : Color(.systemGray4))
                }
                .disabled(!canSubmit)
                .padding(.trailing, 8)
                .padding(.bottom, 8)
            }
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(.systemBackground))
                    .shadow(color: .black.opacity(0.06), radius: 4, y: -2)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.border.opacity(0.5), lineWidth: 1)
            )
            .padding(.horizontal, 12)
            .padding(.top, 4)
            .padding(.bottom, 4)
        }
        .background(Color(.systemBackground))
    }
}
