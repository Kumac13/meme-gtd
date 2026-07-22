import SwiftUI

@MainActor
protocol IssueListStateProviding: ObservableObject {
    var isLoadingMore: Bool { get set }
    var error: String? { get set }
    var isExporting: Bool { get set }
    var showCopiedFeedback: Bool { get set }
    var dataSources: DataSourceProvider { get }
}

extension IssueListStateProviding {
    func performLoadMore(_ operation: () async throws -> Void) async {
        guard !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do { try await operation() }
        catch is CancellationError {}
        catch { self.error = error.localizedDescription }
    }

    func performSearchExport(_ request: SearchExportRequest) async {
        isExporting = true
        defer { isExporting = false }
        do {
            UIPasteboard.general.string = try await dataSources.search.exportSearchResults(request)
            HapticManager.notification(.success)
            showCopiedFeedback = true
            Task {
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                showCopiedFeedback = false
            }
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }
}
