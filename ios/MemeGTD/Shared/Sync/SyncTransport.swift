import Foundation

/// Network boundary of the sync engine (offline support plan S2). Production
/// talks to the server through `APISyncTransport`; unit tests substitute a
/// mock so the engine can be exercised against an in-memory database without
/// any URLSession dependency.
nonisolated protocol SyncTransport: Sendable {
    /// GET /api/sync/changes?since=&limit= — the server change feed, ordered
    /// by serverSeq.
    func fetchChanges(since: Int, limit: Int) async throws -> SyncChangesResponse

    /// POST /api/sync/push — applies the client's pending operations (FIFO,
    /// idempotent per opId).
    func push(_ request: SyncPushRequest) async throws -> SyncPushResponse
}

/// Production transport: a thin wrapper around the shared APIClient.
nonisolated struct APISyncTransport: SyncTransport {
    func fetchChanges(since: Int, limit: Int) async throws -> SyncChangesResponse {
        try await APIClient.shared.get(
            path: "/api/sync/changes",
            queryItems: [
                URLQueryItem(name: "since", value: String(since)),
                URLQueryItem(name: "limit", value: String(limit)),
            ]
        )
    }

    func push(_ request: SyncPushRequest) async throws -> SyncPushResponse {
        try await APIClient.shared.post(path: "/api/sync/push", body: request)
    }
}
