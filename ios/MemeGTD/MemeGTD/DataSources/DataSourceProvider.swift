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
/// Memos, tasks, articles and projects honor the "Offline Sync (Beta)"
/// setting (offline support plan S5 + Phase 7): when it is ON, `memos`
/// becomes the offline-first read/write implementation backed by the local
/// GRDB mirror, and `tasks` / `articles` / `projects` become offline
/// READ-ONLY caches (remote first, local fallback when unreachable). When
/// OFF (default), everything stays `Remote*`, byte-for-byte the previous
/// online-only behavior.
final class DataSourceProvider: ObservableObject {
    private(set) var memos: MemoDataSource
    private(set) var tasks: TaskDataSource
    private(set) var articles: ArticleDataSource
    let search: SearchDataSource
    private(set) var projects: ProjectDataSource
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
        rebuildDataSources()
    }

    /// Called from SettingsView after the Offline Sync toggle changes.
    /// Swaps the implementations; ViewModels hold this provider (not the
    /// data sources), so they pick up the new implementations on next access.
    func offlineSyncSettingDidChange() {
        objectWillChange.send()
        rebuildDataSources()
    }

    private func rebuildDataSources() {
        if Settings.shared.offlineSyncEnabled {
            let scheduler = SharedSync.scheduler
            syncScheduler = scheduler
            memos = OfflineFirstMemoDataSource(
                database: AppDatabase.shared,
                remote: RemoteMemoDataSource(),
                onLocalWrite: { scheduler.requestSync() }
            )
            tasks = OfflineFirstTaskDataSource(
                database: AppDatabase.shared,
                remote: RemoteTaskDataSource()
            )
            articles = OfflineFirstArticleDataSource(
                database: AppDatabase.shared,
                remote: RemoteArticleDataSource()
            )
            projects = OfflineFirstProjectDataSource(
                database: AppDatabase.shared,
                remote: RemoteProjectDataSource()
            )
            // Starts connectivity monitoring and runs an initial sync — with
            // a fresh database the cursor is 0, so this is the full seed pull.
            scheduler.start()
        } else {
            syncScheduler?.stop()
            syncScheduler = nil
            memos = RemoteMemoDataSource()
            tasks = RemoteTaskDataSource()
            articles = RemoteArticleDataSource()
            projects = RemoteProjectDataSource()
        }
    }
}
