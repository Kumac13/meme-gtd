/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SyncService {
    /**
     * List changes after a cursor
     * Return all changes (issues, comments, labels, issue_labels) with serverSeq greater than the cursor, ordered by serverSeq ascending. Soft-deleted issues/comments are included as upserts with isDeleted=true; hard-deleted labels/issue_labels arrive as op:delete tombstones. Pull with since=0 to bootstrap, then repeat with since=<last serverSeq> while hasMore is true.
     * @param since Pull cursor: return changes with serverSeq greater than this value. Use 0 for the initial full pull.
     * @param limit Maximum number of changes to return (default: 500, max: 1000)
     * @returns any Default Response
     * @throws ApiError
     */
    public static listSyncChanges(
        since: number,
        limit?: number,
    ): CancelablePromise<{
        /**
         * Changes ordered by serverSeq ascending
         */
        changes: Array<{
            /**
             * Global monotonic sequence number of this change
             */
            serverSeq: number;
            /**
             * Entity kind this change applies to
             */
            entity: 'issue' | 'comment' | 'label' | 'issue_label';
            /**
             * upsert: apply the row in data; delete: remove the entity identified by data
             */
            op: 'upsert' | 'delete';
            /**
             * Entity payload; shape depends on entity and op (see endpoint description)
             */
            data: Record<string, any>;
        }>;
        /**
         * Highest serverSeq on the server right now
         */
        latestSeq: number;
        /**
         * True when more changes exist beyond this page; pull again with since = last serverSeq
         */
        hasMore: boolean;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/sync/changes',
            query: {
                'since': since,
                'limit': limit,
            },
            errors: {
                400: `Default Response`,
            },
        });
    }
    /**
     * Apply client operations
     * Apply a batch of offline operations (memo/comment create/update/delete) in order. Each operation is idempotent via opId and applies in its own transaction (partial success). Conflict rules: last-write-wins per record; concurrent memo body edits keep the server version and save the client body as a conflicted-copy memo; edits beat deletes in both directions.
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static pushSyncOperations(
        requestBody: {
            /**
             * Stable identifier of the pushing device (used in conflicted-copy annotations)
             */
            deviceId: string;
            /**
             * Operations in client FIFO order (parents before children)
             */
            operations: Array<{
                /**
                 * Client-minted idempotency key (UUID). Replays return the recorded result.
                 */
                opId: string;
                /**
                 * Entity kind this operation targets
                 */
                entity: 'memo' | 'comment';
                /**
                 * Operation type
                 */
                type: 'create' | 'update' | 'delete';
                /**
                 * Sync identity of the target row (client-minted UUIDv7 for offline-created rows)
                 */
                uuid: string;
                /**
                 * Parent issue uuid (required for comment create)
                 */
                issueUuid?: string;
                /**
                 * The server updatedAt this edit was based on. Compared for equality only; mismatch triggers conflict handling.
                 */
                baseUpdatedAt?: string | null;
                /**
                 * Operation payload; omitted for delete
                 */
                payload?: {
                    /**
                     * Body content (required for create)
                     */
                    bodyMd?: string;
                    /**
                     * Bookmark state
                     */
                    isBookmarked?: boolean;
                    /**
                     * Offline authoring time to preserve (create only)
                     */
                    createdAt?: string;
                    /**
                     * Client-side update time (informational)
                     */
                    updatedAt?: string;
                };
            }>;
        },
    ): CancelablePromise<{
        /**
         * One result per operation, same order as the request
         */
        results: Array<{
            /**
             * Echo of the operation opId
             */
            opId: string;
            /**
             * applied: change accepted; alreadyApplied: idempotent replay or existing state; conflictCopied: server version kept, client body saved as a conflicted-copy memo; skipped: dropped (e.g. stale delete lost to edit-beats-delete)
             */
            status: 'applied' | 'alreadyApplied' | 'conflictCopied' | 'skipped';
            /**
             * Sync identity of the target row
             */
            uuid: string;
            /**
             * Server-assigned integer id of the row
             */
            serverId?: number;
            /**
             * Server updatedAt after applying — store as the new base for future edits
             */
            updatedAt?: string;
            /**
             * uuid of the conflicted-copy memo (status conflictCopied only)
             */
            conflictCopyUuid?: string;
        }>;
        /**
         * Highest serverSeq after applying — pull from your last cursor to converge
         */
        latestSeq: number;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/sync/push',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Default Response`,
            },
        });
    }
}
