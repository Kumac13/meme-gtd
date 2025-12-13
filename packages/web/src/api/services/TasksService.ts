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
             * Task status (defaults to "inbox")
             */
            status?: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
            /**
             * Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS)
             */
            scheduledStart?: string;
            /**
             * Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS)
             */
            scheduledEnd?: string;
            /**
             * Whether this is an all-day event
             */
            isAllDay?: boolean;
            /**
             * Scheduled date for the task (YYYY-MM-DD) [DEPRECATED: use scheduledStart]
             */
            scheduledOn?: string;
            /**
             * Start time (HH:MM) [DEPRECATED: use scheduledStart]
             */
            startTime?: string;
            /**
             * End date for the task (YYYY-MM-DD) [DEPRECATED: use scheduledEnd]
             */
            endDate?: string;
            /**
             * End time (HH:MM) [DEPRECATED: use scheduledEnd]
             */
            endTime?: string;
            /**
             * Duration in minutes
             */
            duration?: number;
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
        status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
        /**
         * Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledStart: string | null;
        /**
         * Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledEnd: string | null;
        /**
         * Whether this is an all-day event
         */
        isAllDay: boolean;
        /**
         * Actual start datetime (ISO 8601, null if not started)
         */
        actualStart: string | null;
        /**
         * Actual end datetime (ISO 8601, null if not completed)
         */
        actualEnd: string | null;
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        scheduledOn: string | null;
        /**
         * Start time (HH:MM, null if not set) [DEPRECATED]
         */
        startTime: string | null;
        /**
         * End date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        endDate: string | null;
        /**
         * End time (HH:MM, null if not set) [DEPRECATED]
         */
        endTime: string | null;
        /**
         * Duration in minutes (null if not set)
         */
        duration: number | null;
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
     * @param search Search tasks by title using free-text partial matching
     * @param scheduledFrom Filter tasks where scheduled_on >= this date (YYYY-MM-DD)
     * @param scheduledTo Filter tasks where scheduled_on <= this date (YYYY-MM-DD)
     * @returns any Default Response
     * @throws ApiError
     */
    public static listTasks(
        status?: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled',
        bookmarked?: 'true' | 'false',
        label?: string,
        search?: string,
        scheduledFrom?: string,
        scheduledTo?: string,
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
        status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
        /**
         * Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledStart: string | null;
        /**
         * Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledEnd: string | null;
        /**
         * Whether this is an all-day event
         */
        isAllDay: boolean;
        /**
         * Actual start datetime (ISO 8601, null if not started)
         */
        actualStart: string | null;
        /**
         * Actual end datetime (ISO 8601, null if not completed)
         */
        actualEnd: string | null;
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        scheduledOn: string | null;
        /**
         * Start time (HH:MM, null if not set) [DEPRECATED]
         */
        startTime: string | null;
        /**
         * End date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        endDate: string | null;
        /**
         * End time (HH:MM, null if not set) [DEPRECATED]
         */
        endTime: string | null;
        /**
         * Duration in minutes (null if not set)
         */
        duration: number | null;
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
         * Context preview with highlighted search terms (only present when search parameter is active)
         */
        preview?: string;
        /**
         * Array of project IDs that contain this task
         */
        projectIds: Array<number>;
        /**
         * Array of link IDs associated with this task
         */
        linkIds: Array<number>;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tasks',
            query: {
                'status': status,
                'bookmarked': bookmarked,
                'label': label,
                'search': search,
                'scheduledFrom': scheduledFrom,
                'scheduledTo': scheduledTo,
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
        status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
        /**
         * Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledStart: string | null;
        /**
         * Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledEnd: string | null;
        /**
         * Whether this is an all-day event
         */
        isAllDay: boolean;
        /**
         * Actual start datetime (ISO 8601, null if not started)
         */
        actualStart: string | null;
        /**
         * Actual end datetime (ISO 8601, null if not completed)
         */
        actualEnd: string | null;
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        scheduledOn: string | null;
        /**
         * Start time (HH:MM, null if not set) [DEPRECATED]
         */
        startTime: string | null;
        /**
         * End date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        endDate: string | null;
        /**
         * End time (HH:MM, null if not set) [DEPRECATED]
         */
        endTime: string | null;
        /**
         * Duration in minutes (null if not set)
         */
        duration: number | null;
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
            status?: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
            /**
             * Updated scheduled start datetime (null to clear)
             */
            scheduledStart?: string | null;
            /**
             * Updated scheduled end datetime (null to clear)
             */
            scheduledEnd?: string | null;
            /**
             * Updated all-day event flag
             */
            isAllDay?: boolean;
            /**
             * Actual start datetime (null to clear)
             */
            actualStart?: string | null;
            /**
             * Actual end datetime (null to clear)
             */
            actualEnd?: string | null;
            /**
             * Updated scheduled date (YYYY-MM-DD, null to clear) [DEPRECATED]
             */
            scheduledOn?: string | null;
            /**
             * Updated start time (HH:MM, null to clear) [DEPRECATED]
             */
            startTime?: string | null;
            /**
             * Updated end date (YYYY-MM-DD, null to clear) [DEPRECATED]
             */
            endDate?: string | null;
            /**
             * Updated end time (HH:MM, null to clear) [DEPRECATED]
             */
            endTime?: string | null;
            /**
             * Updated duration in minutes (null to clear)
             */
            duration?: number | null;
            addLabels?: Array<string>;
            removeLabels?: Array<string>;
            projectIds?: Array<number>;
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
        status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
        /**
         * Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledStart: string | null;
        /**
         * Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledEnd: string | null;
        /**
         * Whether this is an all-day event
         */
        isAllDay: boolean;
        /**
         * Actual start datetime (ISO 8601, null if not started)
         */
        actualStart: string | null;
        /**
         * Actual end datetime (ISO 8601, null if not completed)
         */
        actualEnd: string | null;
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        scheduledOn: string | null;
        /**
         * Start time (HH:MM, null if not set) [DEPRECATED]
         */
        startTime: string | null;
        /**
         * End date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        endDate: string | null;
        /**
         * End time (HH:MM, null if not set) [DEPRECATED]
         */
        endTime: string | null;
        /**
         * Duration in minutes (null if not set)
         */
        duration: number | null;
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
        status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
        /**
         * Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledStart: string | null;
        /**
         * Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledEnd: string | null;
        /**
         * Whether this is an all-day event
         */
        isAllDay: boolean;
        /**
         * Actual start datetime (ISO 8601, null if not started)
         */
        actualStart: string | null;
        /**
         * Actual end datetime (ISO 8601, null if not completed)
         */
        actualEnd: string | null;
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        scheduledOn: string | null;
        /**
         * Start time (HH:MM, null if not set) [DEPRECATED]
         */
        startTime: string | null;
        /**
         * End date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        endDate: string | null;
        /**
         * End time (HH:MM, null if not set) [DEPRECATED]
         */
        endTime: string | null;
        /**
         * Duration in minutes (null if not set)
         */
        duration: number | null;
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
        status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
        /**
         * Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledStart: string | null;
        /**
         * Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledEnd: string | null;
        /**
         * Whether this is an all-day event
         */
        isAllDay: boolean;
        /**
         * Actual start datetime (ISO 8601, null if not started)
         */
        actualStart: string | null;
        /**
         * Actual end datetime (ISO 8601, null if not completed)
         */
        actualEnd: string | null;
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        scheduledOn: string | null;
        /**
         * Start time (HH:MM, null if not set) [DEPRECATED]
         */
        startTime: string | null;
        /**
         * End date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        endDate: string | null;
        /**
         * End time (HH:MM, null if not set) [DEPRECATED]
         */
        endTime: string | null;
        /**
         * Duration in minutes (null if not set)
         */
        duration: number | null;
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
        status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
        /**
         * Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledStart: string | null;
        /**
         * Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledEnd: string | null;
        /**
         * Whether this is an all-day event
         */
        isAllDay: boolean;
        /**
         * Actual start datetime (ISO 8601, null if not started)
         */
        actualStart: string | null;
        /**
         * Actual end datetime (ISO 8601, null if not completed)
         */
        actualEnd: string | null;
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        scheduledOn: string | null;
        /**
         * Start time (HH:MM, null if not set) [DEPRECATED]
         */
        startTime: string | null;
        /**
         * End date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        endDate: string | null;
        /**
         * End time (HH:MM, null if not set) [DEPRECATED]
         */
        endTime: string | null;
        /**
         * Duration in minutes (null if not set)
         */
        duration: number | null;
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
        status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
        /**
         * Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledStart: string | null;
        /**
         * Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledEnd: string | null;
        /**
         * Whether this is an all-day event
         */
        isAllDay: boolean;
        /**
         * Actual start datetime (ISO 8601, null if not started)
         */
        actualStart: string | null;
        /**
         * Actual end datetime (ISO 8601, null if not completed)
         */
        actualEnd: string | null;
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        scheduledOn: string | null;
        /**
         * Start time (HH:MM, null if not set) [DEPRECATED]
         */
        startTime: string | null;
        /**
         * End date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        endDate: string | null;
        /**
         * End time (HH:MM, null if not set) [DEPRECATED]
         */
        endTime: string | null;
        /**
         * Duration in minutes (null if not set)
         */
        duration: number | null;
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
        status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
        /**
         * Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledStart: string | null;
        /**
         * Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
         */
        scheduledEnd: string | null;
        /**
         * Whether this is an all-day event
         */
        isAllDay: boolean;
        /**
         * Actual start datetime (ISO 8601, null if not started)
         */
        actualStart: string | null;
        /**
         * Actual end datetime (ISO 8601, null if not completed)
         */
        actualEnd: string | null;
        /**
         * Scheduled date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        scheduledOn: string | null;
        /**
         * Start time (HH:MM, null if not set) [DEPRECATED]
         */
        startTime: string | null;
        /**
         * End date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
         */
        endDate: string | null;
        /**
         * End time (HH:MM, null if not set) [DEPRECATED]
         */
        endTime: string | null;
        /**
         * Duration in minutes (null if not set)
         */
        duration: number | null;
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
    /**
     * Demote task to memo
     * Copy task content (title, body, comments) to create a new memo. The original task remains unchanged.
     * @param id Task ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static demoteTask(
        id: string,
        requestBody?: {
            /**
             * Custom body for the memo (if not provided, body is auto-generated from task content)
             */
            bodyMd?: string;
            /**
             * Labels to apply to the new memo (if not provided, inherits from task)
             */
            labels?: Array<string>;
        },
    ): CancelablePromise<{
        /**
         * The original task (unchanged)
         */
        task: {
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
            status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
            /**
             * Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
             */
            scheduledStart: string | null;
            /**
             * Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS, null if not scheduled)
             */
            scheduledEnd: string | null;
            /**
             * Whether this is an all-day event
             */
            isAllDay: boolean;
            /**
             * Actual start datetime (ISO 8601, null if not started)
             */
            actualStart: string | null;
            /**
             * Actual end datetime (ISO 8601, null if not completed)
             */
            actualEnd: string | null;
            /**
             * Scheduled date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
             */
            scheduledOn: string | null;
            /**
             * Start time (HH:MM, null if not set) [DEPRECATED]
             */
            startTime: string | null;
            /**
             * End date for the task (YYYY-MM-DD, null if not scheduled) [DEPRECATED]
             */
            endDate: string | null;
            /**
             * End time (HH:MM, null if not set) [DEPRECATED]
             */
            endTime: string | null;
            /**
             * Duration in minutes (null if not set)
             */
            duration: number | null;
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
        };
        /**
         * ID of the newly created memo
         */
        memoId: number;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tasks/{id}/demote',
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
}
