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
        HStack(alignment: .center, spacing: 0) {
            TextField(placeholder, text: $text, axis: .vertical)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
                .tint(Color.accent)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.leading, 16)
                .padding(.trailing, 8)
                .padding(.top, 18)
                .padding(.bottom, 16)
                .focused($isFocused)
                .disabled(disabled || submitting)
                .onSubmit {
                    if canSubmit { onSubmit() }
                }

            Button(action: {
                if canSubmit { onSubmit() }
            }) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 32, height: 32)
                    .background(canSubmit ? Color.accent : Color(.systemGray4))
                    .clipShape(Circle())
            }
            .disabled(!canSubmit)
            .padding(.trailing, 10)
        }
        .modifier(PillSurface(radius: 22))
    }
}
