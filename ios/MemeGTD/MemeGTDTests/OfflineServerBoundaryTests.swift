import Foundation
import XCTest
import GRDB
@testable import MemeGTD

/// The HTTP boundary is exercised with URLSession. No request can reach a configured server.
private final class ServerFixtureProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url else { return }
        let status: Int
        let body: String
        switch (url.host, url.path, request.httpMethod) {
        case ("a.test", "/api/articles/42", "PATCH"):
            status = 200
            body = #"{"id":42,"type":"article","title":"Edited","bodyMd":"changed","origin":"manual","createdAt":"now","updatedAt":"now","isBookmarked":false,"isDeleted":false}"#
        case ("a.test", "/api/health", "GET"), ("b.test", "/api/articles", "GET"):
            status = 200
            body = "{}"
        case ("b.test", "/api/health", "GET"):
            status = 500
            body = "{}"
        default:
            status = 404
            body = "{}"
        }
        let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

final class OfflineServerBoundaryTests: XCTestCase {
    private func client(_ host: String) -> APIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ServerFixtureProtocol.self]
        return APIClient(baseUrl: "https://" + host, session: URLSession(configuration: configuration))
    }

    @MainActor
    func testFailedEditorSubmissionPreservesDraftAndEditingMode() async {
        final class Editor: ArticleDetailViewModel {
            var accepted = false
            var submitted: [String] = []
            override func updateArticle(title: String? = nil, bodyMd: String? = nil) async -> Bool {
                submitted.append(bodyMd ?? "")
                return accepted
            }
        }
        let model = Editor(articleId: -1)
        model.editingMode = .body
        model.replyBody = "my replacement"
        await model.submitEdit()
        XCTAssertEqual(model.replyBody, "my replacement")
        XCTAssertEqual(model.editingMode, .body)
        model.accepted = true
        await model.submitEdit()
        XCTAssertEqual(model.submitted, ["my replacement", "my replacement"])
        XCTAssertEqual(model.replyBody, "")
        XCTAssertEqual(model.editingMode, .none)
    }

    func testTestingAnotherEndpointLeavesActiveSettingsAndTransportAlone() async {
        let original = Settings.shared.effectiveApiUrl
        let active = client("a.test")
        let candidate = client("b.test")
        let success = await candidate.testConnection()
        XCTAssertTrue(success)
        XCTAssertEqual(Settings.shared.effectiveApiUrl, original)
        let healthy = await active.probeServerReachability()
        XCTAssertTrue(healthy)
        let healthyB = await candidate.probeServerReachability()
        XCTAssertFalse(healthyB)
    }

    func testReopeningServerKeepsItsQueuedParentRepliesAndCursor() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let suite = "server-boundary-" + UUID().uuidString
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer {
            defaults.removePersistentDomain(forName: suite)
            try? FileManager.default.removeItem(at: directory)
        }
        let settings = Settings(userDefaults: defaults)
        func open(_ endpoint: String) throws -> AppDatabase {
            settings.apiUrl = endpoint
            return try AppDatabase(DatabaseQueue(path: directory.appendingPathComponent(settings.databaseFilename).path))
        }
        let route: Int
        do {
            let database = try open("https://a.test")
            let articles = OfflineFirstArticleDataSource(database: database, remote: RemoteArticleDataSource(client: client("a.test")))
            let article = try await articles.createArticle(CreateManualArticleRequest(title: "A only", bodyMd: "private to A", labels: nil))
            route = article.id
            for text in ["first", "second"] {
                _ = try await articles.createComment(articleId: route, CreateCommentRequest(bodyMd: text))
            }
            try database.setSyncMetaValue("93", for: SyncEngine.lastServerSeqKey)
        }
        let b = try open("https://b.test")
        XCTAssertNil(try b.syncMetaValue(for: SyncEngine.lastServerSeqKey))
        let count = try await b.dbWriter.read { db in try PendingOperationRecord.fetchCount(db) }
        XCTAssertEqual(count, 0)
        let reopened = try open("https://a.test")
        XCTAssertEqual(try reopened.syncMetaValue(for: SyncEngine.lastServerSeqKey), "93")
        let delivery = try await reopened.dbWriter.read { db in
            try ThreadDelivery.read(db, id: route, endpoint: "https://a.test")
        }
        XCTAssertEqual(delivery.comments.map(\.bodyMd), ["first", "second"])
        XCTAssertEqual(delivery.parentState, "Waiting to sync")
    }

    func testEditingArticleThroughCreationRouteAfterAcknowledgmentUsesPositiveRESTID() async throws {
        let database = try AppDatabase.makeInMemory()
        let articles = OfflineFirstArticleDataSource(database: database,
            remote: RemoteArticleDataSource(client: client("a.test")))
        let article = try await articles.createArticle(CreateManualArticleRequest(title: "Draft", bodyMd: "original", labels: nil))
        XCTAssertLessThan(article.id, 0)
        try await database.dbWriter.write { db in
            try db.execute(sql: "UPDATE issues SET server_id = 42 WHERE rowid = ?", arguments: [-article.id])
        }
        let edited = try await articles.updateArticle(id: article.id, UpdateArticleRequest(title: "Edited", bodyMd: "changed"))
        XCTAssertEqual(edited.id, 42)
        XCTAssertEqual(edited.bodyMd, "changed")
    }
}
