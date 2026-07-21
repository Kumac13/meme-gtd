import SwiftUI

/// Bottom sheet shown when the user taps the copy icon in the search bar on
/// a list view. Offers two actions: "Copy Results" (current display only) and
/// "Copy with Comments" (current display plus every comment for each item).
struct CopyOptionsSheet: View {
    @Binding var isPresented: Bool
    let isExporting: Bool
    let onCopyResults: () -> Void
    let onCopyWithComments: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ModalHeader(title: "Copy Search Results", onDismiss: { isPresented = false })

            Divider()

            VStack(alignment: .leading, spacing: 0) {
                Button(action: {
                    HapticManager.selection()
                    onCopyResults()
                }) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Copy Results")
                                .font(.system(size: 16))
                                .foregroundColor(.textPrimary)
                            Text("Currently displayed items only")
                                .font(.system(size: 12))
                                .foregroundColor(Color(.secondaryLabel))
                        }
                        Spacer()
                        Image(systemName: "doc.on.doc")
                            .font(.system(size: 18))
                            .foregroundColor(.accent)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }
                .disabled(isExporting)

                Divider().padding(.leading, 16)

                Button(action: {
                    HapticManager.selection()
                    onCopyWithComments()
                }) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Copy with Comments")
                                .font(.system(size: 16))
                                .foregroundColor(.textPrimary)
                            Text("Includes every comment for each item")
                                .font(.system(size: 12))
                                .foregroundColor(Color(.secondaryLabel))
                        }
                        Spacer()
                        if isExporting {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Image(systemName: "doc.on.doc.fill")
                                .font(.system(size: 18))
                                .foregroundColor(.accent)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }
                .disabled(isExporting)
            }

            Spacer(minLength: 0)
        }
        .background(Color(.systemBackground))
    }
}
