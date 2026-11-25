import Combine
import Foundation

/// App-wide sync machinery, shared by every DataSourceProvider instance so
/// that ViewModels' default providers and the environment-injected provider
/// all drive the same engine/scheduler (the scheduler serializes runs, and
/// `start()` is idempotent). Created lazily: it is only touched when the
/// Offline Sync setting is on, so the OFF path never builds any sync objects.
@MainActor
private enum SharedSync {
    private static var active: SyncScheduler?
    private static var schedulers: [String: SyncScheduler] = [:]
    static func scheduler(for database: AppDatabase) -> SyncScheduler {
        let client = APIClient.shared
        if let cached = schedulers[client.baseUrl] {
            if active !== cached {
                active?.stop()
                active = cached
            }
            return cached
        }
        active?.stop()
        let projects = RemoteProjectDataSource(client: client)
        let scheduler = SyncScheduler(engine: SyncEngine(database: database, transport: APISyncTransport(client: client),
            syncMemberships: {
                try await OfflineFirstProjectDataSource.flushMemberships(database: database, remote: projects)
            }, refreshProjects: { try await projects.refreshMembershipSnapshot(database) }))
        schedulers[client.baseUrl] = scheduler
        active = scheduler
        return scheduler
    }
}

/// Assembles the concrete data source implementations the ViewModels consume.
/// Injected as an `environmentObject` from `MemeGTDApp` and handed to each
/// ViewModel alongside its store (see the `.task` wiring in the Views).
///
/// The implementations follow the Storage Mode setting (offline support plan
/// Phase 8):
///
/// - Serverモードはメモ・手動記事の作成と各スレッドへのコメントを端末に保存し、自動同期する。
/// - `.standalone`: memos, tasks, articles, keyword search, labels and issue
///   relations are fully local (`LocalMemoDataSource` / `LocalTaskDataSource`
///   / `LocalArticleDataSource` / `LocalSearchDataSource` /
///   `LocalLabelDataSource` / `LocalIssueRelationsDataSource` — no outbox, no
///   network; articles are written by the Share Extension since Phase 10);
///   projects remain a safe empty implementation. No sync scheduler runs.
final class DataSourceProvider: ObservableObject {
    private(set) var memos: MemoDataSource
    private(set) var tasks: TaskDataSource
    private(set) var articles: ArticleDataSource
    private(set) var search: SearchDataSource
    private(set) var projects: ProjectDataSource
    private(set) var labels: LabelDataSource
    private(set) var issueRelations: IssueRelationsDataSource
    private(set) var templates: TemplateDataSource

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
        self.templates = RemoteTemplateDataSource()
        rebuildDataSources()
    }

    /// Called from SettingsView after the Storage Mode changes. Swaps the
    /// implementations; ViewModels hold this provider (not the data
    /// sources), so they pick up the new implementations on next access.
    func storageSettingDidChange() {
        objectWillChange.send()
        rebuildDataSources()
    }

    private func rebuildDataSources() {
        // Standalone (Phase 8, tasks/search/labels/relations local since
        // Phase 9, articles since Phase 10): everything the app touches is
        // local — no scheduler, no remote wrappers, so nothing can reach
        // APIError.noConfiguration even with no API URL configured. Projects
        // remain a safe empty stand-in.
        if Settings.shared.appMode == .standalone {
            syncScheduler?.stop()
            syncScheduler = nil
            memos = LocalMemoDataSource(database: AppDatabase.shared)
            tasks = LocalTaskDataSource(database: AppDatabase.shared)
            articles = LocalArticleDataSource(database: AppDatabase.shared)
            search = LocalSearchDataSource(database: AppDatabase.shared)
            projects = EmptyProjectDataSource()
            labels = LocalLabelDataSource(database: AppDatabase.shared)
            issueRelations = LocalIssueRelationsDataSource(database: AppDatabase.shared)
            templates = EmptyTemplateDataSource()
            return
        }

        // Server mode: always synced and offline-capable.
        search = RemoteSearchDataSource()
        labels = RemoteLabelDataSource(localFallback: LocalLabelDataSource(database: AppDatabase.shared))
        issueRelations = RemoteIssueRelationsDataSource()
        templates = RemoteTemplateDataSource()
        let scheduler = SharedSync.scheduler(for: AppDatabase.shared)
        syncScheduler = scheduler
        memos = OfflineFirstMemoDataSource(
            database: AppDatabase.shared,
            remote: RemoteMemoDataSource(),
            onLocalWrite: { Task { @MainActor in scheduler.requestSync(refreshProjects: false) } }
        )
        tasks = OfflineFirstTaskDataSource(
            database: AppDatabase.shared,
            remote: RemoteTaskDataSource(),
            onLocalWrite: { Task { @MainActor in scheduler.requestSync(refreshProjects: false) } }
        )
        articles = OfflineFirstArticleDataSource(
            database: AppDatabase.shared,
            remote: RemoteArticleDataSource(),
            onLocalWrite: { Task { @MainActor in scheduler.requestSync(refreshProjects: false) } }
        )
        projects = OfflineFirstProjectDataSource(
            database: AppDatabase.shared,
            remote: RemoteProjectDataSource()
        )
        // Starts connectivity monitoring and runs an initial sync — with
        // a fresh database the cursor is 0, so this is the full seed pull.
        scheduler.start()
    }
}
