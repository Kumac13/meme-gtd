import SwiftUI

/// Lists every pending Outbox operation and lets the user retry the queue
/// or discard individual rows. The sheet is opened from OfflineBanner.
struct OutboxStatusSheet: View {
    @EnvironmentObject var memoStore: MemoStore
    @EnvironmentObject var syncEngine: SyncEngine
    @Environment(\.dismiss) private var dismiss
    @State private var showDiscardAllConfirm = false

    var body: some View {
        NavigationStack {
            List {
                let rows = memoStore.outboxRows()
                if rows.isEmpty {
                    Section {
                        Text("No pending operations — everything is in sync.")
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Section(header: Text("Pending (\(rows.count))")) {
                        ForEach(rows) { row in
                            OutboxRowView(row: row)
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        memoStore.discardOutboxRow(id: row.id)
                                    } label: {
                                        Label("Discard", systemImage: "trash")
                                    }
                                }
                        }
                    }
                    Section {
                        Button {
                            syncEngine.kick()
                        } label: {
                            Label("Retry all now", systemImage: "arrow.clockwise")
                        }
                        Button(role: .destructive) {
                            showDiscardAllConfirm = true
                        } label: {
                            Label("Discard all", systemImage: "trash")
                        }
                    }
                }
            }
            .navigationTitle("Outbox")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                "Discard every pending operation? Local memos created offline will be removed.",
                isPresented: $showDiscardAllConfirm,
                titleVisibility: .visible
            ) {
                Button("Discard all", role: .destructive) {
                    memoStore.discardAllOutbox()
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }
}

private struct OutboxRowView: View {
    let row: MemoStore.OutboxRow

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(kindLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if row.retryCount > 0 {
                    Text("retry \(row.retryCount)")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
            }
            Text(row.preview)
                .font(.body)
                .lineLimit(3)
            if let err = row.lastError {
                Text(err)
                    .font(.caption2)
                    .foregroundStyle(.red)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 2)
    }

    private var kindLabel: String {
        switch row.kind {
        case "createMemo": return "Create memo"
        case "updateMemo": return "Edit memo"
        case "deleteMemo": return "Delete memo"
        case "createComment": return "Add comment"
        case "updateComment": return "Edit comment"
        case "deleteComment": return "Delete comment"
        default: return row.kind
        }
    }
}
