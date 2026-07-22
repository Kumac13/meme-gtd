import SwiftUI

/// Shared modal header, scrolling body and anchored search field for multi-select pickers.
struct MultiSelectPickerShell<Content: View>: View {
    let title: String
    let onDismiss: () -> Void
    let trailingAction: ModalHeader.TrailingAction
    @Binding var searchText: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            ModalHeader(title: title, onDismiss: onDismiss, trailingAction: trailingAction)
            Divider()
            ZStack(alignment: .bottom) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        content()
                        Color.clear.frame(height: 70)
                    }
                }
                PickerSearchBar(text: $searchText, placeholder: "Search")
            }
        }
        .background(Color(.systemBackground))
    }
}
