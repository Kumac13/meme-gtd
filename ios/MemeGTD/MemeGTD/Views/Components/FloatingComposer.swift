import SwiftUI

struct FloatingComposer: View {
    @Binding var text: String
    let placeholder: String
    var disabled: Bool = false
    var submitting: Bool = false
    var notice: String? = nil
    var onDismissNotice: (() -> Void)? = nil
    var onAttachImage: (() -> Void)? = nil
    var isUploadingImage: Bool = false
    let onSubmit: () -> Void

    @FocusState private var isFocused: Bool

    private var canSubmit: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !disabled && !submitting
    }

    var body: some View {
        VStack(spacing: 0) {
            if let notice = notice {
                HStack(spacing: 6) {
                    Text(notice)
                        .font(.system(size: 13))
                        .foregroundColor(.accentDark)
                    Spacer()
                    if let onDismiss = onDismissNotice {
                        Button(action: onDismiss) {
                            Image(systemName: "xmark")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(.accentDark)
                                .frame(width: 24, height: 24)
                                .contentShape(Rectangle())
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.accent.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .padding(.horizontal, 10)
                .padding(.top, 10)
            }

            // Text input area
            TextField(placeholder, text: $text, axis: .vertical)
                .lineLimit(2...8)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
                .tint(Color.accent)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 16)
                .padding(.top, notice != nil ? 10 : 14)
                .padding(.bottom, 8)
                .focused($isFocused)
                .disabled(disabled || submitting)
                .onSubmit {
                    if canSubmit { onSubmit() }
                }

            // Bottom toolbar row
            HStack(spacing: 12) {
                if let onAttach = onAttachImage {
                    if isUploadingImage {
                        HStack(spacing: 6) {
                            ProgressView()
                                .frame(width: 16, height: 16)
                            Text("Uploading...")
                                .font(.system(size: 12))
                                .foregroundColor(.textSecondary)
                        }
                    } else {
                        Button(action: onAttach) {
                            Image(systemName: "plus")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(.textSecondary)
                                .frame(width: 28, height: 28)
                        }
                        .disabled(disabled)
                    }
                }

                Spacer()

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
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 10)
        }
        .modifier(PillSurface(radius: 22))
    }
}
