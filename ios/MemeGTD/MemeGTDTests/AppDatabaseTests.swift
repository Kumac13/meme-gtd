import XCTest
import GRDB
@testable import MemeGTD

final class AppDatabaseTests: XCTestCase {
    func testMigrationCreatesAllTables() throws {
        let database = try AppDatabase.makeInMemory()

        let tables = try database.dbWriter.read { db in
            try String.fetchAll(
                db,
                sql: """
                    SELECT name FROM sqlite_master
                    WHERE type = 'table'
                      AND name NOT LIKE 'sqlite_%'
                      AND name NOT LIKE 'grdb_%'
                    ORDER BY name
                    """
            )
        }

        XCTAssertEqual(tables, [
            "comments",
            "issue_labels",
            "issues",
            "labels",
            "links",
            "pending_operations",
            "project_items",
            "projects",
            "sync_meta",
            "url_links",
        ])
    }

    func testMigrationIsIdempotentOnReopen() throws {
        // Same writer migrated twice must not fail (already-applied
        // migrations are skipped by DatabaseMigrator).
        let dbQueue = try DatabaseQueue()
        _ = try AppDatabase(dbQueue)
        XCTAssertNoThrow(try AppDatabase(dbQueue))
    }

    func testSyncMetaRoundTrip() throws {
        let database = try AppDatabase.makeInMemory()

        XCTAssertNil(try database.syncMetaValue(for: "last_server_seq"))

        try database.setSyncMetaValue("42", for: "last_server_seq")
        XCTAssertEqual(try database.syncMetaValue(for: "last_server_seq"), "42")

        // Setting the same key again overwrites the previous value.
        try database.setSyncMetaValue("43", for: "last_server_seq")
        XCTAssertEqual(try database.syncMetaValue(for: "last_server_seq"), "43")
    }

    func testDeviceIDIsGeneratedOnceAndPersisted() throws {
        let database = try AppDatabase.makeInMemory()

        let first = try DeviceID.identifier(in: database)
        let second = try DeviceID.identifier(in: database)

        XCTAssertEqual(first, second)
        XCTAssertEqual(try database.syncMetaValue(for: DeviceID.syncMetaKey), first)
        // The identifier is a lowercase UUID string.
        XCTAssertNotNil(first.range(
            of: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            options: .regularExpression
        ))
    }
}
