import SwiftUI

/// Shared sheet for list filters that select exactly one option.
struct SingleChoiceFilterSheet<Option: Hashable>: View {
    let title: String
    let options: [Option]
    let selected: Option
    let label: (Option) -> String
    let onSelect: (Option) -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ModalHeader(title: title, onDismiss: onDismiss)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(options, id: \.self) { option in
                        Button(action: {
                            HapticManager.selection()
                            onSelect(option)
                        }) {
                            HStack {
                                Text(label(option))
                                    .font(.system(size: 16))
                                    .foregroundColor(.textPrimary)
                                Spacer()
                                PickerSelectionIndicator(isSelected: selected == option)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                        }
                        Divider().padding(.leading, 16)
                    }
                }
            }
        }
        .background(Color(.systemBackground))
    }
}
