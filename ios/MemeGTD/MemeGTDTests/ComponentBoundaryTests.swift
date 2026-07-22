import XCTest

/// 共通コンポーネントの所有権ルール（docs/architecture.md が正）の構造チェック。
/// Web 側の packages/web/tests/unit/ComponentBoundaries.test.ts と同じルールを
/// Xcode のテスト実行でも検証する。ディレクトリ走査ベースなので新規ファイルも対象に入る。
final class ComponentBoundaryTests: XCTestCase {
    private static let appSourceURL = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent() // MemeGTDTests/
        .deletingLastPathComponent() // MemeGTD/ (project root)
        .appendingPathComponent("MemeGTD")

    private func swiftFiles() throws -> [(path: String, contents: String)] {
        let root = Self.appSourceURL
        guard let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) else {
            XCTFail("Cannot enumerate \(root.path)")
            return []
        }
        var files: [(String, String)] = []
        for case let url as URL in enumerator where url.pathExtension == "swift" {
            let relative = url.path.replacingOccurrences(of: root.path + "/", with: "")
            files.append((relative, try String(contentsOf: url, encoding: .utf8)))
        }
        XCTAssertGreaterThan(files.count, 50, "source scan looks broken")
        return files
    }

    func testListViewModelsAdoptIssueListStateProviding() throws {
        let targets = try swiftFiles().filter { $0.path.hasSuffix("ListViewModel.swift") }
        XCTAssertGreaterThanOrEqual(targets.count, 4)
        for file in targets {
            XCTAssertTrue(file.contents.contains("IssueListStateProviding"), "\(file.path) must adopt IssueListStateProviding")
            XCTAssertTrue(file.contents.contains("performLoadMore"), "\(file.path) must load more via performLoadMore")
        }
    }

    func testDetailViewModelsAdoptIssueMetadataManaging() throws {
        let targets = try swiftFiles().filter { $0.path.hasSuffix("DetailViewModel.swift") }
        XCTAssertGreaterThanOrEqual(targets.count, 4)
        for file in targets {
            XCTAssertTrue(file.contents.contains("IssueMetadataManaging"), "\(file.path) must adopt IssueMetadataManaging")
        }
    }

    func testMetadataAndRelationServicesAreOnlyConstructedInSharedProtocols() throws {
        let allowlist = ["Protocols/IssueDetailManaging.swift"]
        for file in try swiftFiles() where !allowlist.contains(file.path) {
            for pattern in ["IssueMetadataService(", "IssueRelationService("] {
                XCTAssertFalse(
                    file.contents.contains(pattern),
                    "\(file.path) must not construct \(pattern)...) — use the IssueDetailManaging default implementations"
                )
            }
        }
    }

    func testIssueCellsUseIssueCellLayout() throws {
        let targets = try swiftFiles().filter { $0.path.contains("Views/Components/") && $0.path.hasSuffix("Cell.swift") }
        XCTAssertGreaterThanOrEqual(targets.count, 3)
        for file in targets {
            XCTAssertTrue(file.contents.contains("IssueCellLayout"), "\(file.path) must use IssueCellLayout")
        }
    }

    func testMultiSelectPickersUseMultiSelectPickerShell() throws {
        let files = try swiftFiles()
        for path in ["Views/Components/LabelPickerModal.swift", "Views/Components/ProjectPickerModal.swift"] {
            let file = files.first { $0.path == path }
            XCTAssertNotNil(file, "\(path) is missing")
            XCTAssertTrue(file?.contents.contains("MultiSelectPickerShell") == true, "\(path) must use MultiSelectPickerShell")
        }
    }
}
