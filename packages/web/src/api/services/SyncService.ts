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
     * Apply a batch of offline operations in order. memo/comment support create/update/delete; task/article/label/issue_label/link support create only (iOS Standalone -> Server bulk migration; send in dependency order: labels, then issues, then issue_labels/comments, then links). Each operation is idempotent via opId and applies in its own transaction (partial success). Replays are also detected without the opId ledger: task/article on uuid, label on name, issue_label/link on the existing pair — all reported as alreadyApplied. Operations with unresolvable references are skipped with a reason. Conflict rules for memo/comment: last-write-wins per record; concurrent memo body edits keep the server version and save the client body as a conflicted-copy memo; edits beat deletes in both directions.
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
                 * Entity kind this operation targets. memo/comment support create/update/delete; task/article/label/issue_label/link support create only (bulk migration).
                 */
                entity: 'memo' | 'comment' | 'task' | 'article' | 'label' | 'issue_label' | 'link';
                /**
                 * Operation type
                 */
                type: 'create' | 'update' | 'delete';
                /**
                 * Sync identity of the target row (client-minted UUIDv7 for offline-created rows). Echoed back for entities without a server uuid column (label / issue_label / link).
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
                 * Operation payload; omitted for delete. Which fields apply depends on entity.
                 */
                payload?: {
                    /**
                     * Body content (required for memo/comment/article create; optional for task)
                     */
                    bodyMd?: string;
                    /**
                     * Bookmark state (memo only)
                     */
                    isBookmarked?: boolean;
                    /**
                     * Offline authoring time to preserve (create only)
                     */
                    createdAt?: string;
                    /**
                     * Client-side update time (stored as-is for task create; informational otherwise)
                     */
                    updatedAt?: string;
                    /**
                     * Title (required for task/article create)
                     */
                    title?: string;
                    /**
                     * Task status (task create only; default inbox)
                     */
                    status?: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
                    /**
                     * Task kind (task create only; default action)
                     */
                    taskKind?: 'event' | 'action';
                    /**
                     * Scheduled start, ISO 8601 datetime (task create only)
                     */
                    scheduledStart?: string;
                    /**
                     * Scheduled end, ISO 8601 datetime (task create only)
                     */
                    scheduledEnd?: string;
                    /**
                     * All-day flag (task create only)
                     */
                    isAllDay?: boolean;
                    /**
                     * Deprecated scheduled date YYYY-MM-DD (task create only, backward compatibility)
                     */
                    scheduledOn?: string;
                    /**
                     * Execution start stamp to preserve, ISO 8601 datetime (task create only)
                     */
                    actualStart?: string;
                    /**
                     * Execution end stamp to preserve, ISO 8601 datetime (task create only)
                     */
                    actualEnd?: string;
                    /**
                     * Article metadata (article create only)
                     */
                    meta?: {
                        /**
                         * Source URL (required for article create)
                         */
                        originalUrl?: string;
                        /**
                         * Site name
                         */
                        siteName?: string;
                        /**
                         * Client-side archive time to preserve
                         */
                        archivedAt?: string;
                    };
                    /**
                     * Label name — the natural key (required for label create)
                     */
                    name?: string;
                    /**
                     * Label description (label create only)
                     */
                    description?: string;
                    /**
                     * Target issue uuid (required for issue_label create)
                     */
                    issueUuid?: string;
                    /**
                     * Label name to attach (required for issue_label create)
                     */
                    labelName?: string;
                    /**
                     * Link source issue uuid (required for link create)
                     */
                    sourceIssueUuid?: string;
                    /**
                     * Link target issue uuid (required for link create)
                     */
                    targetIssueUuid?: string;
                    /**
                     * Link type (required for link create)
                     */
                    linkType?: 'parent' | 'child' | 'relates' | 'derived_from';
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
            /**
             * Human-readable explanation for skipped bulk-migration operations (e.g. unresolved issue/label reference)
             */
            reason?: string;
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
