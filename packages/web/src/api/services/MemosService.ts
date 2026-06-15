/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class MemosService {
    /**
     * Create memo
     * Create a new memo. When a `clientId` (ULID) is supplied and a memo with that clientId already exists, returns the existing memo with status 200 instead of creating a duplicate. This makes retries from the iOS offline outbox idempotent.
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createMemo(
        requestBody: {
            /**
             * Memo content in Markdown format
             */
            bodyMd: string;
            /**
             * Optional client-generated ULID used to make retries from an offline outbox idempotent. When the same clientId is sent twice, the server returns the existing memo with HTTP 200 instead of creating a duplicate.
             */
            clientId?: string;
        },
    ): CancelablePromise<{
        /**
         * Unique memo ID
         */
        id: number;
        /**
         * Issue type (always "memo")
         */
        type: 'memo';
        /**
         * Title (always null for memos)
         */
        title: string | null;
        /**
         * Memo content in Markdown format
         */
        bodyMd: string;
        /**
         * Status (always null for memos)
         */
        status: string | null;
        /**
         * Scheduled date (always null for memos)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the memo is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the memo is soft-deleted
         */
        isDeleted: boolean;
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Array of label names assigned to this memo
         */
        labels: Array<string>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/memos',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Default Response`,
            },
        });
    }
    /**
     * List memos
     * List all memos with optional filters and pagination
     * @param bookmarked Filter by bookmark status
     * @param label Filter by label name(s). Supports comma-separated values for OR logic (e.g., idea,meeting-notes)
     * @param projectId Filter by project ID(s). Supports comma-separated values for OR logic (e.g., 1,2,3). Use "none" to filter memos not assigned to any project. Can be combined: "none,1".
     * @param search Search memos by body content using free-text partial matching
     * @param createdFrom Filter memos created on or after this date (YYYY-MM-DD)
     * @param createdTo Filter memos created on or before this date (YYYY-MM-DD)
     * @param limit Maximum number of memos to return (default: 100, max: 1000)
     * @param offset Number of memos to skip (default: 0)
     * @returns any Default Response
     * @throws ApiError
     */
    public static listMemos(
        bookmarked?: 'true' | 'false',
        label?: string,
        projectId?: string,
        search?: string,
        createdFrom?: string,
        createdTo?: string,
        limit?: number,
        offset?: number,
    ): CancelablePromise<{
        /**
         * Array of memos
         */
        data: Array<{
            /**
             * Unique memo ID
             */
            id: number;
            /**
             * Issue type (always "memo")
             */
            type: 'memo';
            /**
             * Title (always null for memos)
             */
            title: string | null;
            /**
             * Memo content in Markdown format
             */
            bodyMd: string;
            /**
             * Status (always null for memos)
             */
            status: string | null;
            /**
             * Scheduled date (always null for memos)
             */
            scheduledOn: string | null;
            /**
             * Metadata object
             */
            meta: Record<string, any>;
            /**
             * Whether the memo is bookmarked
             */
            isBookmarked: boolean;
            /**
             * Whether the memo is soft-deleted
             */
            isDeleted: boolean;
            /**
             * Creation timestamp
             */
            createdAt: string;
            /**
             * Last update timestamp
             */
            updatedAt: string;
            /**
             * Array of label names assigned to this memo
             */
            labels: Array<string>;
            /**
             * Number of non-deleted comments on this memo
             */
            commentCount: number;
            /**
             * Context preview with highlighted search terms (only present when search parameter is active)
             */
            preview?: string;
        }>;
        /**
         * Total count of memos matching the filters (ignoring pagination)
         */
        total: number;
        /**
         * Maximum number of memos returned per page
         */
        limit: number;
        /**
         * Number of memos skipped
         */
        offset: number;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/memos',
            query: {
                'bookmarked': bookmarked,
                'label': label,
                'projectId': projectId,
                'search': search,
                'createdFrom': createdFrom,
                'createdTo': createdTo,
                'limit': limit,
                'offset': offset,
            },
            errors: {
                400: `Default Response`,
            },
        });
    }
    /**
     * Get memo
     * Get memo by ID
     * @param id Memo ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static getMemo(
        id: string,
    ): CancelablePromise<{
        /**
         * Unique memo ID
         */
        id: number;
        /**
         * Issue type (always "memo")
         */
        type: 'memo';
        /**
         * Title (always null for memos)
         */
        title: string | null;
        /**
         * Memo content in Markdown format
         */
        bodyMd: string;
        /**
         * Status (always null for memos)
         */
        status: string | null;
        /**
         * Scheduled date (always null for memos)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the memo is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the memo is soft-deleted
         */
        isDeleted: boolean;
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Array of label names assigned to this memo
         */
        labels: Array<string>;
        /**
         * Number of comments on this memo
         */
        commentsCount?: number;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/memos/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Update memo
     * Update memo
     * @param id Memo ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static updateMemo(
        id: string,
        requestBody?: {
            /**
             * Updated memo content in Markdown format
             */
            bodyMd?: string;
            /**
             * Bookmark status
             */
            isBookmarked?: boolean;
        },
    ): CancelablePromise<{
        /**
         * Unique memo ID
         */
        id: number;
        /**
         * Issue type (always "memo")
         */
        type: 'memo';
        /**
         * Title (always null for memos)
         */
        title: string | null;
        /**
         * Memo content in Markdown format
         */
        bodyMd: string;
        /**
         * Status (always null for memos)
         */
        status: string | null;
        /**
         * Scheduled date (always null for memos)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the memo is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the memo is soft-deleted
         */
        isDeleted: boolean;
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Array of label names assigned to this memo
         */
        labels: Array<string>;
    }> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/memos/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Default Response`,
                404: `Default Response`,
            },
        });
    }
    /**
     * Delete memo
     * Delete memo (soft delete)
     * @param id Memo ID
     * @returns void
     * @throws ApiError
     */
    public static deleteMemo(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/memos/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Preview promotion body
     * Return the task body that would result from promoting this memo now (memo body with comments inlined). Read-only; no side effects.
     * @param id Memo ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static getPromotePreview(
        id: string,
    ): CancelablePromise<{
        /**
         * The task body that would be created by promoting this memo (memo body with comments inlined).
         */
        bodyMd: string;
        /**
         * Label names attached to the memo, suggested as initial labels for the promoted task.
         */
        labels: Array<string>;
        /**
         * Project IDs the memo belongs to, suggested as initial projects for the promoted task.
         */
        projectIds: Array<number>;
        /**
         * Issue links attached to the memo, suggested as initial links for the promoted task.
         */
        linkedIssues: Array<{
            /**
             * Direction of the link relative to the memo
             */
            direction: 'outgoing' | 'incoming';
            /**
             * Link type (parent, child, relates, derived_from, etc.)
             */
            linkType: string;
            targetIssue: {
                id: number;
                /**
                 * Target issue type (memo, task, article)
                 */
                type: string;
                /**
                 * Target issue title or body excerpt for memos
                 */
                title: string;
            };
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/memos/{id}/promote-preview',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Bookmark memo
     * Bookmark memo
     * @param id Memo ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static bookmarkMemo(
        id: string,
    ): CancelablePromise<{
        /**
         * Unique memo ID
         */
        id: number;
        /**
         * Issue type (always "memo")
         */
        type: 'memo';
        /**
         * Title (always null for memos)
         */
        title: string | null;
        /**
         * Memo content in Markdown format
         */
        bodyMd: string;
        /**
         * Status (always null for memos)
         */
        status: string | null;
        /**
         * Scheduled date (always null for memos)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the memo is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the memo is soft-deleted
         */
        isDeleted: boolean;
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Array of label names assigned to this memo
         */
        labels: Array<string>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/memos/{id}/bookmark',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Unbookmark memo
     * Unbookmark memo
     * @param id Memo ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static unbookmarkMemo(
        id: string,
    ): CancelablePromise<{
        /**
         * Unique memo ID
         */
        id: number;
        /**
         * Issue type (always "memo")
         */
        type: 'memo';
        /**
         * Title (always null for memos)
         */
        title: string | null;
        /**
         * Memo content in Markdown format
         */
        bodyMd: string;
        /**
         * Status (always null for memos)
         */
        status: string | null;
        /**
         * Scheduled date (always null for memos)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the memo is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the memo is soft-deleted
         */
        isDeleted: boolean;
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Array of label names assigned to this memo
         */
        labels: Array<string>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/memos/{id}/unbookmark',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
}
