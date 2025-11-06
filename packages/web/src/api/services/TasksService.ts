/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TasksService {
    /**
     * Create task
     * Create a new task
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createTask(
        requestBody: {
            /**
             * Task title
             */
            title: string;
            /**
             * Task description in Markdown format
             */
            bodyMd?: string;
            /**
             * Task status (defaults to "open")
             */
            status?: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
            /**
             * Scheduled date for the task (YYYY-MM-DD)
             */
            scheduledOn?: string;
        },
    ): CancelablePromise<{
        /**
         * Unique task ID
         */
        id: number;
        /**
         * Issue type (always "task")
         */
        type: 'task';
        /**
         * Task title
         */
        title: string;
        /**
         * Task description in Markdown format
         */
        bodyMd: string;
        /**
         * Current task status
         */
        status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the task is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the task is soft-deleted
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
         * Array of label names assigned to this task
         */
        labels: Array<string>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tasks',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Default Response`,
            },
        });
    }
    /**
     * List tasks
     * List all tasks with optional filters
     * @param status Filter by task status
     * @param bookmarked Filter by bookmark status
     * @param label Filter by label name(s). Supports comma-separated values for OR logic (e.g., bug,enhancement)
     * @param search Search tasks by title and body using free-text partial matching (SQLite FTS5). Supports multi-word queries with implicit AND logic.
     * @returns any Default Response
     * @throws ApiError
     */
    public static listTasks(
        status?: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled',
        bookmarked?: 'true' | 'false',
        label?: string,
        search?: string,
    ): CancelablePromise<Array<{
        /**
         * Unique task ID
         */
        id: number;
        /**
         * Issue type (always "task")
         */
        type: 'task';
        /**
         * Task title
         */
        title: string;
        /**
         * Task description in Markdown format
         */
        bodyMd: string;
        /**
         * Current task status
         */
        status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the task is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the task is soft-deleted
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
         * Array of label names assigned to this task
         */
        labels: Array<string>;
        /**
         * Number of non-deleted comments on this task
         */
        commentCount: number;
        /**
         * Context preview with highlighted search terms (only present when searching)
         */
        preview?: string;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tasks',
            query: {
                'status': status,
                'bookmarked': bookmarked,
                'label': label,
                'search': search,
            },
            errors: {
                400: `Default Response`,
            },
        });
    }
    /**
     * Get task
     * Get task by ID
     * @param id Task ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static getTask(
        id: string,
    ): CancelablePromise<{
        /**
         * Unique task ID
         */
        id: number;
        /**
         * Issue type (always "task")
         */
        type: 'task';
        /**
         * Task title
         */
        title: string;
        /**
         * Task description in Markdown format
         */
        bodyMd: string;
        /**
         * Current task status
         */
        status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the task is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the task is soft-deleted
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
         * Array of label names assigned to this task
         */
        labels: Array<string>;
        /**
         * Number of comments on this task
         */
        commentsCount?: number;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tasks/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Update task
     * Update task
     * @param id Task ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static updateTask(
        id: string,
        requestBody?: {
            /**
             * Updated task title
             */
            title?: string;
            /**
             * Updated task description in Markdown format
             */
            bodyMd?: string;
            /**
             * Updated task status
             */
            status?: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
            /**
             * Updated scheduled date (YYYY-MM-DD, null to clear)
             */
            scheduledOn?: string | null;
        },
    ): CancelablePromise<{
        /**
         * Unique task ID
         */
        id: number;
        /**
         * Issue type (always "task")
         */
        type: 'task';
        /**
         * Task title
         */
        title: string;
        /**
         * Task description in Markdown format
         */
        bodyMd: string;
        /**
         * Current task status
         */
        status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the task is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the task is soft-deleted
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
         * Array of label names assigned to this task
         */
        labels: Array<string>;
    }> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/tasks/{id}',
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
     * Delete task
     * Delete task (soft delete)
     * @param id Task ID
     * @returns void
     * @throws ApiError
     */
    public static deleteTask(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/tasks/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Close task
     * Close task (set status to done)
     * @param id Task ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static closeTask(
        id: string,
    ): CancelablePromise<{
        /**
         * Unique task ID
         */
        id: number;
        /**
         * Issue type (always "task")
         */
        type: 'task';
        /**
         * Task title
         */
        title: string;
        /**
         * Task description in Markdown format
         */
        bodyMd: string;
        /**
         * Current task status
         */
        status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the task is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the task is soft-deleted
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
         * Array of label names assigned to this task
         */
        labels: Array<string>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tasks/{id}/close',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Cancel task
     * Cancel task (set status to canceled)
     * @param id Task ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static cancelTask(
        id: string,
    ): CancelablePromise<{
        /**
         * Unique task ID
         */
        id: number;
        /**
         * Issue type (always "task")
         */
        type: 'task';
        /**
         * Task title
         */
        title: string;
        /**
         * Task description in Markdown format
         */
        bodyMd: string;
        /**
         * Current task status
         */
        status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the task is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the task is soft-deleted
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
         * Array of label names assigned to this task
         */
        labels: Array<string>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tasks/{id}/cancel',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Reopen task
     * Reopen task (set status to open)
     * @param id Task ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static reopenTask(
        id: string,
    ): CancelablePromise<{
        /**
         * Unique task ID
         */
        id: number;
        /**
         * Issue type (always "task")
         */
        type: 'task';
        /**
         * Task title
         */
        title: string;
        /**
         * Task description in Markdown format
         */
        bodyMd: string;
        /**
         * Current task status
         */
        status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the task is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the task is soft-deleted
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
         * Array of label names assigned to this task
         */
        labels: Array<string>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tasks/{id}/reopen',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Bookmark task
     * Bookmark task
     * @param id Task ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static bookmarkTask(
        id: string,
    ): CancelablePromise<{
        /**
         * Unique task ID
         */
        id: number;
        /**
         * Issue type (always "task")
         */
        type: 'task';
        /**
         * Task title
         */
        title: string;
        /**
         * Task description in Markdown format
         */
        bodyMd: string;
        /**
         * Current task status
         */
        status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the task is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the task is soft-deleted
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
         * Array of label names assigned to this task
         */
        labels: Array<string>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tasks/{id}/bookmark',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Unbookmark task
     * Unbookmark task
     * @param id Task ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static unbookmarkTask(
        id: string,
    ): CancelablePromise<{
        /**
         * Unique task ID
         */
        id: number;
        /**
         * Issue type (always "task")
         */
        type: 'task';
        /**
         * Task title
         */
        title: string;
        /**
         * Task description in Markdown format
         */
        bodyMd: string;
        /**
         * Current task status
         */
        status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled)
         */
        scheduledOn: string | null;
        /**
         * Metadata object
         */
        meta: Record<string, any>;
        /**
         * Whether the task is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the task is soft-deleted
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
         * Array of label names assigned to this task
         */
        labels: Array<string>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tasks/{id}/unbookmark',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
}
