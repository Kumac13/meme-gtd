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
            HStack {
                Button(action: {
                    HapticManager.impact(.light)
                    onDismiss()
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(Color(.tertiaryLabel))
                }
                Spacer()
                Text(title)
                    .font(.system(size: 17, weight: .semibold))
                Spacer()
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 28))
                    .hidden()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

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
                                Image(systemName: selected == option ? "checkmark.circle.fill" : "plus.circle")
                                    .font(.system(size: 22))
                                    .foregroundColor(selected == option ? .accent : Color(.systemGray3))
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
