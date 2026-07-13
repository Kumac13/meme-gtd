import SwiftUI

struct FormNavigationRow<Selection: View>: View {
    let title: String
    let action: () -> Void
    @ViewBuilder let selection: () -> Selection

    var body: some View {
        Button(action: {
            HapticManager.impact(.light)
            action()
        }) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text(title)
                        .font(.system(size: 15))
                        .foregroundColor(.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color(.systemGray3))
                }

                selection()
                    .padding(.top, 4)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
    }
}

struct EmptyFormSelection: View {
    var body: some View {
        Text("None")
            .font(.system(size: 13))
            .foregroundColor(.textSecondary)
    }
}

struct SegmentedFormRow<Option: Hashable>: View {
    let title: String
    let options: [Option]
    @Binding var selected: Option
    let label: (Option) -> String

    var body: some View {
        HStack {
            Text(title)
                .font(.system(size: 15))
                .foregroundColor(.textPrimary)
            Spacer()
            Picker(title, selection: $selected) {
                ForEach(options, id: \.self) { option in
                    Text(label(option)).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 180)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}
