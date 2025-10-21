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
     * Create a new memo
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
     * List all memos with optional filters
     * @param bookmarked Filter by bookmark status
     * @returns any Default Response
     * @throws ApiError
     */
    public static listMemos(
        bookmarked?: 'true' | 'false',
    ): CancelablePromise<Array<{
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
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/memos',
            query: {
                'bookmarked': bookmarked,
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
     * Promote memo to task
     * Promote memo to task
     * @param id Memo ID
     * @param requestBody
     * @returns any Promoted task
     * @throws ApiError
     */
    public static promoteMemo(
        id: string,
        requestBody: {
            /**
             * Title for the new task
             */
            title: string;
            /**
             * Initial status for the task
             */
            status?: 'open' | 'next' | 'waiting' | 'scheduled';
        },
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/memos/{id}/promote',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
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
