import SwiftUI
import GRDB

/// 送信を保留した本文は、元の親が削除された場合もここからコピーできる。
struct OfflineQueueStatus: View {
    @State private var entries: [String] = []
    @State private var showingEntries = false

    var body: some View {
        // 空のときもDB監視タスクを保持する。
        VStack(spacing: 0) {
            if !entries.isEmpty {
                Button("Saved on device (\(entries.count))") { showingEntries = true }
                    .font(.caption)
                    .sheet(isPresented: $showingEntries) {
                        NavigationStack {
                            List(Array(entries.enumerated()), id: \.offset) { entry in
                                Text(entry.element).textSelection(.enabled)
                            }
                            .navigationTitle("Pending changes")
                        }
                    }
            }
        }
        .task {
            guard Settings.shared.appMode == .server else { return }
            let observation = ValueObservation.tracking { db in
                let ops = try String.fetchAll(db, sql: """
                    SELECT CASE state WHEN 'review' THEN 'Needs review' ELSE 'Waiting to sync' END
                        || ' · ' || entity || char(10)
                        || COALESCE(json_extract(payload, '$.bodyMd'), json_extract(payload, '$.labelName'), op_type)
                    FROM pending_operations ORDER BY id
                    """)
                let memberships = try String.fetchAll(db, sql: """
                    SELECT CASE needs_review WHEN 1 THEN 'Needs review' ELSE 'Waiting to sync' END
                        || ' · Project #' || project_id || ' · ' || coalesce(i.title, i.body_md, '')
                    FROM pending_memberships m JOIN issues i ON i.uuid = m.issue_uuid
                    """)
                return ops + memberships
            }
            do {
                for try await snapshot in observation.values(in: AppDatabase.shared.dbWriter) {
                    entries = snapshot
                }
            } catch { return }
        }
    }
}
