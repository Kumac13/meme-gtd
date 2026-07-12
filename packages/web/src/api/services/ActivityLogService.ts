/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ActivityLogService {
    /**
     * List activity log entries
     * List activity log entries with optional filters
     * @param issueId Filter by issue ID
     * @param projectId Filter by project ID
     * @param labelId Filter by label ID
     * @param eventType Filter by event type
     * @param sourceType Filter by source type
     * @param from Filter logs from this datetime (ISO 8601)
     * @param to Filter logs until this datetime (ISO 8601)
     * @param limit Maximum number of entries to return
     * @param offset Number of entries to skip
     * @param order Sort order by occurred_at
     * @returns any Default Response
     * @throws ApiError
     */
    public static listActivityLog(
        issueId?: number,
        projectId?: number,
        labelId?: number,
        eventType?: 'task.created' | 'task.updated' | 'task.status_changed' | 'task.deleted' | 'task.bookmarked' | 'memo.created' | 'memo.updated' | 'memo.promoted' | 'memo.deleted' | 'memo.bookmarked' | 'article.created' | 'article.updated' | 'article.deleted' | 'article.bookmarked' | 'label.created' | 'label.deleted' | 'label.assigned' | 'label.removed' | 'project.created' | 'project.updated' | 'project.deleted' | 'project.item_added' | 'project.item_removed' | 'link.created' | 'link.deleted' | 'comment.created' | 'comment.updated' | 'comment.deleted' | 'search.exported',
        sourceType?: 'cli' | 'api' | 'system',
        from?: string,
        to?: string,
        limit: number = 100,
        offset?: number,
        order: 'asc' | 'desc' = 'desc',
    ): CancelablePromise<Array<{
        /**
         * Unique identifier
         */
        id: number;
        /**
         * Event type (e.g., task.created, task.status_changed)
         */
        eventType: 'task.created' | 'task.updated' | 'task.status_changed' | 'task.deleted' | 'task.bookmarked' | 'memo.created' | 'memo.updated' | 'memo.promoted' | 'memo.deleted' | 'memo.bookmarked' | 'article.created' | 'article.updated' | 'article.deleted' | 'article.bookmarked' | 'label.created' | 'label.deleted' | 'label.assigned' | 'label.removed' | 'project.created' | 'project.updated' | 'project.deleted' | 'project.item_added' | 'project.item_removed' | 'link.created' | 'link.deleted' | 'comment.created' | 'comment.updated' | 'comment.deleted' | 'search.exported';
        /**
         * Event timestamp (ISO 8601)
         */
        occurredAt: string;
        /**
         * Source of the operation
         */
        sourceType: 'cli' | 'api' | 'system';
        /**
         * Event-specific data
         */
        payload: Record<string, any>;
        /**
         * Related issue ID (extracted from payload)
         */
        issueId: number | null;
        /**
         * Related project ID (extracted from payload)
         */
        projectId: number | null;
        /**
         * Related label ID (extracted from payload)
         */
        labelId: number | null;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/activity-log',
            query: {
                'issueId': issueId,
                'projectId': projectId,
                'labelId': labelId,
                'eventType': eventType,
                'sourceType': sourceType,
                'from': from,
                'to': to,
                'limit': limit,
                'offset': offset,
                'order': order,
            },
            errors: {
                400: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * Get issue activity log
     * Get activity log entries for a specific issue (task or memo)
     * @param issueId Issue ID
     * @param limit Maximum number of entries to return
     * @param order Sort order by occurred_at
     * @returns any Default Response
     * @throws ApiError
     */
    public static getIssueActivityLog(
        issueId: number,
        limit: number = 100,
        order: 'asc' | 'desc' = 'asc',
    ): CancelablePromise<Array<{
        /**
         * Unique identifier
         */
        id: number;
        /**
         * Event type (e.g., task.created, task.status_changed)
         */
        eventType: 'task.created' | 'task.updated' | 'task.status_changed' | 'task.deleted' | 'task.bookmarked' | 'memo.created' | 'memo.updated' | 'memo.promoted' | 'memo.deleted' | 'memo.bookmarked' | 'article.created' | 'article.updated' | 'article.deleted' | 'article.bookmarked' | 'label.created' | 'label.deleted' | 'label.assigned' | 'label.removed' | 'project.created' | 'project.updated' | 'project.deleted' | 'project.item_added' | 'project.item_removed' | 'link.created' | 'link.deleted' | 'comment.created' | 'comment.updated' | 'comment.deleted' | 'search.exported';
        /**
         * Event timestamp (ISO 8601)
         */
        occurredAt: string;
        /**
         * Source of the operation
         */
        sourceType: 'cli' | 'api' | 'system';
        /**
         * Event-specific data
         */
        payload: Record<string, any>;
        /**
         * Related issue ID (extracted from payload)
         */
        issueId: number | null;
        /**
         * Related project ID (extracted from payload)
         */
        projectId: number | null;
        /**
         * Related label ID (extracted from payload)
         */
        labelId: number | null;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/activity-log/issues/{issueId}',
            path: {
                'issueId': issueId,
            },
            query: {
                'limit': limit,
                'order': order,
            },
            errors: {
                400: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * Get project activity log
     * Get activity log entries for a specific project
     * @param projectId Project ID
     * @param limit Maximum number of entries to return
     * @param order Sort order by occurred_at
     * @returns any Default Response
     * @throws ApiError
     */
    public static getProjectActivityLog(
        projectId: number,
        limit: number = 100,
        order: 'asc' | 'desc' = 'desc',
    ): CancelablePromise<Array<{
        /**
         * Unique identifier
         */
        id: number;
        /**
         * Event type (e.g., task.created, task.status_changed)
         */
        eventType: 'task.created' | 'task.updated' | 'task.status_changed' | 'task.deleted' | 'task.bookmarked' | 'memo.created' | 'memo.updated' | 'memo.promoted' | 'memo.deleted' | 'memo.bookmarked' | 'article.created' | 'article.updated' | 'article.deleted' | 'article.bookmarked' | 'label.created' | 'label.deleted' | 'label.assigned' | 'label.removed' | 'project.created' | 'project.updated' | 'project.deleted' | 'project.item_added' | 'project.item_removed' | 'link.created' | 'link.deleted' | 'comment.created' | 'comment.updated' | 'comment.deleted' | 'search.exported';
        /**
         * Event timestamp (ISO 8601)
         */
        occurredAt: string;
        /**
         * Source of the operation
         */
        sourceType: 'cli' | 'api' | 'system';
        /**
         * Event-specific data
         */
        payload: Record<string, any>;
        /**
         * Related issue ID (extracted from payload)
         */
        issueId: number | null;
        /**
         * Related project ID (extracted from payload)
         */
        projectId: number | null;
        /**
         * Related label ID (extracted from payload)
         */
        labelId: number | null;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/activity-log/projects/{projectId}',
            path: {
                'projectId': projectId,
            },
            query: {
                'limit': limit,
                'order': order,
            },
            errors: {
                400: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * Get completed tasks
     * Get tasks that were completed within a date range
     * @param from Start date (YYYY-MM-DD), defaults to today
     * @param to End date (YYYY-MM-DD), defaults to today
     * @param limit Maximum number of entries to return
     * @returns any Default Response
     * @throws ApiError
     */
    public static getCompletedTasks(
        from?: string,
        to?: string,
        limit: number = 100,
    ): CancelablePromise<Array<{
        /**
         * Task ID
         */
        taskId: number;
        /**
         * Task title at completion time
         */
        title: string;
        /**
         * Completion timestamp
         */
        completedAt: string;
        /**
         * Projects at completion time
         */
        projectSnapshot?: Array<{
            id: number;
            name: string;
        }>;
        /**
         * Labels at completion time
         */
        labelSnapshot?: Array<{
            id: number;
            name: string;
        }>;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/activity-log/completed-tasks',
            query: {
                'from': from,
                'to': to,
                'limit': limit,
            },
            errors: {
                400: `Default Response`,
                500: `Default Response`,
            },
        });
    }
}
