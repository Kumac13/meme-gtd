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
    var onExpand: (() -> Void)? = nil
    let onSubmit: () -> Void

    @FocusState private var isFocused: Bool
    @State private var expanded: Bool = false

    private var canSubmit: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !disabled && !submitting
    }

    private var isExpanded: Bool {
        expanded
            || !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || isUploadingImage
    }

    var body: some View {
        VStack(spacing: 0) {
            // Notice banner (only when expanded and editing)
            if let notice = notice, isExpanded {
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

            // Text input area - always in hierarchy to preserve focus identity
            TextField(placeholder, text: $text, axis: .vertical)
                .lineLimit(2...8)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
                .tint(Color.accent)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, isExpanded ? 16 : 0)
                .padding(.top, isExpanded ? (notice != nil ? 10 : 14) : 0)
                .padding(.bottom, isExpanded ? 8 : 0)
                .frame(maxHeight: isExpanded ? nil : 0, alignment: .top)
                .clipped()
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

                if !isExpanded {
                    // Compact: tappable placeholder to trigger focus
                    Text(placeholder)
                        .font(.system(size: 14))
                        .foregroundColor(Color(.placeholderText))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            expanded = true
                            onExpand?()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                                isFocused = true
                            }
                        }
                } else {
                    Spacer()
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
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 10)
            .padding(.top, isExpanded ? 0 : 10)
        }
        .modifier(PillSurface(radius: 22))
        .animation(.easeInOut(duration: 0.2), value: isExpanded)
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            expanded = false
        }
    }
}
