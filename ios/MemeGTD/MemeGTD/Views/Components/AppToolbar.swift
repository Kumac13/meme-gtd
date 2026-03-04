import SwiftUI

struct AppToolbar<Trailing: View>: ToolbarContent {
    let title: String
    let onMenuTap: () -> Void
    var titleLineLimit: Int? = nil
    @ViewBuilder let trailing: () -> Trailing

    init(
        title: String,
        onMenuTap: @escaping () -> Void,
        titleLineLimit: Int? = nil,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.title = title
        self.onMenuTap = onMenuTap
        self.titleLineLimit = titleLineLimit
        self.trailing = trailing
    }

    var body: some ToolbarContent {
        ToolbarItem(placement: .navigationBarLeading) {
            Button(action: onMenuTap) {
                Image(systemName: "line.3.horizontal")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(.textPrimary)
            }
        }

        ToolbarItem(placement: .principal) {
            if let lineLimit = titleLineLimit {
                Text(title)
                    .font(.headline)
                    .lineLimit(lineLimit)
                    .truncationMode(.tail)
            } else {
                Text(title)
                    .font(.headline)
            }
        }

        ToolbarItem(placement: .navigationBarTrailing) {
            trailing()
        }
    }
}
