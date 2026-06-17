import SwiftUI

/// Lists outbox rows whose memo create never made it to the server. Each row
/// is swipe-actionable: Retry resets backoff and kicks the SyncEngine,
/// Delete drops both the outbox row and the local_memos row (with a
/// confirmation, since deleting a failed memo discards the user's typed text
/// forever).
struct FailedMemosView: View {
    @EnvironmentObject private var syncEngine: SyncEngine
    @State private var operations: [OutboxOperation] = []
    @State private var pendingDelete: OutboxOperation?
    @State private var loadError: String?

    private let outbox = OutboxRepository()
    private let memos = LocalMemoRepository()

    var body: some View {
        List {
            if let error = loadError {
                Section {
                    Text(error).foregroundStyle(.red)
                }
            }
            if operations.isEmpty && loadError == nil {
                Section {
                    Text("No failed memos.").foregroundStyle(.secondary)
                }
            }
            ForEach(operations, id: \.id) { op in
                FailedMemoRow(operation: op)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button {
                            pendingDelete = op
                        } label: { Label("Delete", systemImage: "trash") }
                            .tint(.red)

                        Button {
                            Task { await retry(op) }
                        } label: { Label("Retry", systemImage: "arrow.clockwise") }
                            .tint(.blue)
                    }
            }
        }
        .navigationTitle("Failed memos")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { reload() }
        // Re-read the table whenever SyncEngine finishes a drain or its
        // failure tally changes. Avoids the previous foot-gun where Retry
        // was a fire-and-forget kick but reload() ran immediately, so the
        // user never saw `attempts` update or the row disappear without a
        // manual pull.
        .onChange(of: syncEngine.isSyncing) { _, syncing in
            if !syncing { reload() }
        }
        .onChange(of: syncEngine.failedCount) { _, _ in
            reload()
        }
        .confirmationDialog(
            "Delete this memo?",
            isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ),
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { op in
            Button("Delete", role: .destructive) {
                deleteConfirmed(op)
            }
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        } message: { _ in
            Text("The memo body will be lost permanently.")
        }
    }

    private func reload() {
        do {
            operations = try outbox.failedOperations()
            loadError = nil
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func retry(_ op: OutboxOperation) async {
        // The reactive reload (.onChange of isSyncing / failedCount) refreshes
        // the list once the drain finishes, so we don't call reload() here.
        await syncEngine.retryFailed(operationId: op.id)
    }

    private func deleteConfirmed(_ op: OutboxOperation) {
        do {
            try outbox.deleteOperationAndMemo(id: op.id, memoRepository: memos)
            pendingDelete = nil
            reload()
        } catch {
            loadError = error.localizedDescription
        }
    }
}

private struct FailedMemoRow: View {
    let operation: OutboxOperation

    /// Decodes the stored CreateMemoRequest payload so the user can recognize
    /// which memo they typed. Falls back to "(unreadable payload)" rather
    /// than crashing if the JSON is malformed — better to surface a bad row
    /// in the UI than hide it.
    private var preview: String {
        if let payload = try? JSONDecoder().decode(LocalMemo.CreatePayload.self, from: operation.payload) {
            return payload.bodyMd
        }
        return "(unreadable payload)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(preview)
                .lineLimit(2)
                .font(.body)
            HStack(spacing: 8) {
                Text("attempts: \(operation.attempts)")
                if let err = operation.lastError {
                    Text(err).lineLimit(1)
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
