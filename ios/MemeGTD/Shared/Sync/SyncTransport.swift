import Foundation

/// Network boundary of the sync engine (offline support plan S2). Production
/// talks to the server through `APISyncTransport`; unit tests substitute a
/// mock so the engine can be exercised against an in-memory database without
/// any URLSession dependency.
nonisolated protocol SyncTransport: Sendable {
    /// GET /api/sync/changes?since=&limit= — the server change feed, ordered
    /// by serverSeq.
    func fetchChanges(since: Int, limit: Int) async throws -> SyncChangesResponse

    /// Whether this server accepts the additional Task write payloads.
    func supportsTaskSyncWrites() async throws -> Bool

    /// POST /api/sync/push — applies the client's pending operations (FIFO,
    /// idempotent per opId).
    func push(_ request: SyncPushRequest) async throws -> SyncPushResponse
}

extension SyncTransport {
    // Test transports that exercise the current contract support Task writes.
    func supportsTaskSyncWrites() async throws -> Bool { true }
}

/// Production transport: a thin wrapper around the shared APIClient.
nonisolated struct APISyncTransport: SyncTransport {
    var client = APIClient.shared

    func fetchChanges(since: Int, limit: Int) async throws -> SyncChangesResponse {
        try await client.get(
            path: "/api/sync/changes",
            queryItems: [
                URLQueryItem(name: "since", value: String(since)),
                URLQueryItem(name: "limit", value: String(limit)),
            ]
        )
    }

    func supportsTaskSyncWrites() async throws -> Bool {
        struct HealthCapabilities: Decodable {
            let supportsTaskSyncWrites: Bool?
        }
        do {
            let health: HealthCapabilities = try await client.get(path: "/api/health")
            return health.supportsTaskSyncWrites == true
        } catch APIError.serverError(404, _) {
            return false
        }
    }

    func push(_ request: SyncPushRequest) async throws -> SyncPushResponse {
        try await client.post(path: "/api/sync/push", body: request)
    }
}
