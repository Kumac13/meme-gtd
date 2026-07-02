import Combine
import Foundation

/// Assembles the concrete data source implementations the ViewModels consume.
/// Injected as an `environmentObject` from `MemeGTDApp` and handed to each
/// ViewModel alongside its store (see the `.task` wiring in the Views).
///
/// Currently fixed to the `Remote*` (server-backed) implementations. Later
/// phases swap in offline-first / local implementations here based on the
/// app mode and sync settings, without touching the ViewModels.
final class DataSourceProvider: ObservableObject {
    let memos: MemoDataSource
    let tasks: TaskDataSource
    let articles: ArticleDataSource
    let search: SearchDataSource
    let projects: ProjectDataSource
    let labels: LabelDataSource
    let issueRelations: IssueRelationsDataSource

    init() {
        self.memos = RemoteMemoDataSource()
        self.tasks = RemoteTaskDataSource()
        self.articles = RemoteArticleDataSource()
        self.search = RemoteSearchDataSource()
        self.projects = RemoteProjectDataSource()
        self.labels = RemoteLabelDataSource()
        self.issueRelations = RemoteIssueRelationsDataSource()
    }
}
