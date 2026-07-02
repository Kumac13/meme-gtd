import Combine
import Foundation

/// App-wide sync machinery, shared by every DataSourceProvider instance so
/// that ViewModels' default providers and the environment-injected provider
/// all drive the same engine/scheduler (the scheduler serializes runs, and
/// `start()` is idempotent). Created lazily: it is only touched when the
/// Offline Sync setting is on, so the OFF path never builds any sync objects.
@MainActor
private enum SharedSync {
    static let scheduler = SyncScheduler(
        engine: SyncEngine(database: AppDatabase.shared, transport: APISyncTransport())
    )
}

/// Assembles the concrete data source implementations the ViewModels consume.
/// Injected as an `environmentObject` from `MemeGTDApp` and handed to each
/// ViewModel alongside its store (see the `.task` wiring in the Views).
///
/// Memos honor the "Offline Sync (Beta)" setting (offline support plan S5):
/// when it is ON, `memos` becomes the offline-first implementation backed by
/// the local GRDB mirror; when OFF (default), everything stays `Remote*`,
/// byte-for-byte the previous online-only behavior. All other data sources
/// are remote-only until later phases.
final class DataSourceProvider: ObservableObject {
    private(set) var memos: MemoDataSource
    let tasks: TaskDataSource
    let articles: ArticleDataSource
    let search: SearchDataSource
    let projects: ProjectDataSource
    let labels: LabelDataSource
    let issueRelations: IssueRelationsDataSource

    /// Non-nil while offline sync is enabled. Exposed so the app can forward
    /// scene-activation triggers and views can hook pull-to-refresh.
    private(set) var syncScheduler: SyncScheduler?

    init() {
        self.memos = RemoteMemoDataSource()
        self.tasks = RemoteTaskDataSource()
        self.articles = RemoteArticleDataSource()
        self.search = RemoteSearchDataSource()
        self.projects = RemoteProjectDataSource()
        self.labels = RemoteLabelDataSource()
        self.issueRelations = RemoteIssueRelationsDataSource()
        rebuildMemoDataSource()
    }

    /// Called from SettingsView after the Offline Sync toggle changes.
    /// Swaps the memo implementation; ViewModels hold this provider (not the
    /// data source), so they pick up the new implementation on next access.
    func offlineSyncSettingDidChange() {
        objectWillChange.send()
        rebuildMemoDataSource()
    }

    private func rebuildMemoDataSource() {
        if Settings.shared.offlineSyncEnabled {
            let scheduler = SharedSync.scheduler
            syncScheduler = scheduler
            memos = OfflineFirstMemoDataSource(
                database: AppDatabase.shared,
                remote: RemoteMemoDataSource(),
                onLocalWrite: { scheduler.requestSync() }
            )
            // Starts connectivity monitoring and runs an initial sync — with
            // a fresh database the cursor is 0, so this is the full seed pull.
            scheduler.start()
        } else {
            syncScheduler?.stop()
            syncScheduler = nil
            memos = RemoteMemoDataSource()
        }
    }
}
