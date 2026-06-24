import SwiftUI

/// Modal sheet shown when one or more memos hit a sync conflict — typically
/// because the server-side row was deleted while the user had a local edit
/// pending. The user decides, per memo, whether to keep the local copy
/// (re-create it on the server) or discard it (server truth wins).
struct ConflictResolveSheet: View {
    @EnvironmentObject var memoStore: MemoStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                let conflicts = memoStore.conflictMemos()
                if conflicts.isEmpty {
                    Section {
                        Text("No conflicts — everything is back in sync.")
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Section(header: Text("Conflicts")) {
                        ForEach(conflicts) { memo in
                            ConflictRow(memo: memo)
                        }
                    }
                    Section {
                        Text("Pick **Keep local** to re-create the memo on the server as a new row. Pick **Discard** to drop the local copy (the server's deletion wins).")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Resolve conflicts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct ConflictRow: View {
    let memo: Memo
    @EnvironmentObject var memoStore: MemoStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(memo.bodyMd)
                .font(.body)
                .lineLimit(4)
            HStack(spacing: 12) {
                Button {
                    memoStore.resolveConflictKeepLocal(memoId: memo.id)
                } label: {
                    Label("Keep local", systemImage: "arrow.uturn.up")
                }
                .buttonStyle(.borderedProminent)

                Button(role: .destructive) {
                    memoStore.resolveConflictDiscard(memoId: memo.id)
                } label: {
                    Label("Discard", systemImage: "trash")
                }
                .buttonStyle(.bordered)
            }
            .controlSize(.small)
        }
        .padding(.vertical, 4)
    }
}
