import Foundation
import GRDB

/// Errors surfaced by the local article store (English, user-facing).
nonisolated enum LocalArticleError: Error, LocalizedError {
    case articleNotFound
    case titleRequired

    var errorDescription: String? {
        switch self {
        case .articleNotFound:
            return "Article not found in the local database."
        case .titleRequired:
            // Same message the server answers for an empty title
            // (articleSchemas.ts CreateArticleRequestSchema).
            return "Article title is required"
        }
    }
}

/// Local (GRDB) article persistence — offline support plan Phase 10.
///
/// This file lives under `Shared/` because the Share Extension saves
/// extracted articles straight into the App Group database when Storage Mode
/// is Standalone, and extension code cannot reference app-target sources.
/// Only what the extension needs is here: the insert and the meta JSON
/// codec. The read side returns app-target response models, so it is an
/// extension of this type in the app target
/// (`MemeGTD/DataSources/LocalArticleStore+App.swift`), shared by
/// `OfflineFirstArticleDataSource` and `LocalArticleDataSource`.
///
/// Like the other Local*Store types, this knows NOTHING about the outbox or
/// the network: every function operates on a `Database` handle inside the
/// caller's transaction.
nonisolated enum LocalArticleStore {
    // MARK: - Insert

    /// Inserts a new article row applying the server's create semantics
    /// (articleRepository.createArticle): title must be non-empty
    /// (articleSchemas.ts), type is 'article', the row starts not bookmarked
    /// and not deleted, and the meta JSON carries
    /// `{ originalUrl, siteName, archivedAt }` with archivedAt equal to
    /// created_at.
    static func insertArticle(
        _ db: Database,
        uuid: String,
        title: String,
        bodyMd: String,
        originalUrl: String,
        siteName: String?,
        now: String
    ) throws {
        guard !title.isEmpty else {
            throw LocalArticleError.titleRequired
        }
        let meta = ArticleMeta(
            originalUrl: originalUrl,
            siteName: siteName,
            archivedAt: now
        )
        let record = IssueRecord(
            uuid: uuid,
            serverId: nil,
            type: "article",
            title: title,
            bodyMd: bodyMd,
            meta: try metaJSON(meta),
            createdAt: now,
            updatedAt: now
        )
        try record.insert(db)
    }

    // MARK: - Meta JSON codec

    /// Serializes ArticleMeta into the JSON shape the server stores
    /// (articleRepository.createArticle): a flat object whose siteName key is
    /// omitted when absent, exactly like JSON.stringify drops undefined.
    /// Key order differs from the server (sorted here for determinism), which
    /// is invisible to every JSON consumer including the Phase 12 migration.
    static func metaJSON(_ meta: ArticleMeta) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let data = try encoder.encode(meta)
        return String(decoding: data, as: UTF8.self)
    }

    /// The local `meta` column stores the server's JSON verbatim (see
    /// SyncChangeApplier.jsonString); a value that does not decode as
    /// ArticleMeta is surfaced as nil, same as an absent meta.
    static func articleMeta(from raw: String?) -> ArticleMeta? {
        guard let raw, let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(ArticleMeta.self, from: data)
    }
}
