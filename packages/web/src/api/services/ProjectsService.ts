/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ProjectsService {
    /**
     * Create project
     * Create a new project
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createProject(
        requestBody: {
            /**
             * Project name (must be unique)
             */
            name: string;
            /**
             * Optional project description
             */
            description?: string | null;
            /**
             * View type (defaults to board)
             */
            view?: 'board' | 'table';
            /**
             * Project status
             */
            status?: 'planned' | 'active' | 'paused' | 'done' | 'canceled';
            /**
             * Start date (YYYY-MM-DD)
             */
            startDate?: string | null;
            /**
             * End date (YYYY-MM-DD)
             */
            endDate?: string | null;
        },
    ): CancelablePromise<{
        /**
         * Unique project ID
         */
        id: number;
        /**
         * Project name
         */
        name: string;
        /**
         * Project description
         */
        description: string | null;
        /**
         * Project status
         */
        status: 'planned' | 'active' | 'paused' | 'done' | 'canceled';
        /**
         * Start date (YYYY-MM-DD)
         */
        startDate: string | null;
        /**
         * End date (YYYY-MM-DD)
         */
        endDate: string | null;
        /**
         * View configuration
         */
        viewMeta: {
            /**
             * View type: board or table
             */
            viewType: 'board' | 'table';
            /**
             * Column names for board view
             */
            columns?: Array<string>;
        };
        /**
         * Creation timestamp
         */
        createdAt: string;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/projects',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Default Response`,
                409: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * List projects
     * List all projects
     * @returns any Default Response
     * @throws ApiError
     */
    public static listProjects(): CancelablePromise<Array<{
        /**
         * Unique project ID
         */
        id: number;
        /**
         * Project name
         */
        name: string;
        /**
         * Project description
         */
        description: string | null;
        /**
         * Project status
         */
        status: 'planned' | 'active' | 'paused' | 'done' | 'canceled';
        /**
         * Start date (YYYY-MM-DD)
         */
        startDate: string | null;
        /**
         * End date (YYYY-MM-DD)
         */
        endDate: string | null;
        /**
         * View configuration
         */
        viewMeta: {
            /**
             * View type: board or table
             */
            viewType: 'board' | 'table';
            /**
             * Column names for board view
             */
            columns?: Array<string>;
        };
        /**
         * Creation timestamp
         */
        createdAt: string;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/projects',
            errors: {
                500: `Default Response`,
            },
        });
    }
    /**
     * Get project
     * Get project details with associated items
     * @param id Project ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static getProject(
        id: string,
    ): CancelablePromise<{
        /**
         * Unique project ID
         */
        id: number;
        /**
         * Project name
         */
        name: string;
        /**
         * Project description
         */
        description: string | null;
        /**
         * Project status
         */
        status: 'planned' | 'active' | 'paused' | 'done' | 'canceled';
        /**
         * Start date (YYYY-MM-DD)
         */
        startDate: string | null;
        /**
         * End date (YYYY-MM-DD)
         */
        endDate: string | null;
        /**
         * View configuration
         */
        viewMeta: {
            /**
             * View type: board or table
             */
            viewType: 'board' | 'table';
            /**
             * Column names for board view
             */
            columns?: Array<string>;
        };
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Project items with issue information
         */
        items: Array<{
            /**
             * Project item ID
             */
            id: number;
            /**
             * Project ID
             */
            projectId: number;
            /**
             * Issue ID
             */
            issueId: number;
            /**
             * Position in project
             */
            position: number;
            /**
             * Item view metadata
             */
            viewMeta: {
                column?: string;
            } | null;
            /**
             * Creation timestamp
             */
            createdAt: string;
            /**
             * Last update timestamp
             */
            updatedAt: string;
            /**
             * Issue information
             */
            issue: {
                /**
                 * Issue ID
                 */
                id: number;
                /**
                 * Issue type
                 */
                type: 'memo' | 'task' | 'article';
                /**
                 * Issue title
                 */
                title: string;
                /**
                 * Task status (null for memos)
                 */
                status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled' | null;
            };
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/projects/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * Update project
     * Update project name and/or description
     * @param id Project ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static updateProject(
        id: string,
        requestBody?: {
            /**
             * Project name
             */
            name?: string;
            /**
             * Project description
             */
            description?: string | null;
            /**
             * Project status
             */
            status?: 'planned' | 'active' | 'paused' | 'done' | 'canceled';
            /**
             * Start date (YYYY-MM-DD)
             */
            startDate?: string | null;
            /**
             * End date (YYYY-MM-DD)
             */
            endDate?: string | null;
        },
    ): CancelablePromise<{
        /**
         * Unique project ID
         */
        id: number;
        /**
         * Project name
         */
        name: string;
        /**
         * Project description
         */
        description: string | null;
        /**
         * Project status
         */
        status: 'planned' | 'active' | 'paused' | 'done' | 'canceled';
        /**
         * Start date (YYYY-MM-DD)
         */
        startDate: string | null;
        /**
         * End date (YYYY-MM-DD)
         */
        endDate: string | null;
        /**
         * View configuration
         */
        viewMeta: {
            /**
             * View type: board or table
             */
            viewType: 'board' | 'table';
            /**
             * Column names for board view
             */
            columns?: Array<string>;
        };
        /**
         * Creation timestamp
         */
        createdAt: string;
    }> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/projects/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * Delete project
     * Delete a project (cascades to project items, issues remain intact)
     * @param id Project ID
     * @returns void
     * @throws ApiError
     */
    public static deleteProject(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/projects/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * Add item to project
     * Add an issue (task or memo) to a project
     * @param id Project ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static addProjectItem(
        id: string,
        requestBody: {
            /**
             * Issue ID to add
             */
            issueId: number;
            /**
             * Position in project (defaults to end)
             */
            position?: number;
            /**
             * Board column name
             */
            column?: string | null;
        },
    ): CancelablePromise<{
        /**
         * Project item ID
         */
        id: number;
        /**
         * Project ID
         */
        projectId: number;
        /**
         * Issue ID
         */
        issueId: number;
        /**
         * Position in project
         */
        position: number;
        /**
         * Item view metadata
         */
        viewMeta: {
            column?: string;
        } | null;
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/projects/{id}/items',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Default Response`,
                404: `Default Response`,
                409: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * Update project item
     * Move item to new position or column
     * @param id Project ID
     * @param issueId Issue ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static updateProjectItem(
        id: string,
        issueId: string,
        requestBody?: {
            /**
             * New position
             */
            position?: number;
            /**
             * New column
             */
            column?: string | null;
        },
    ): CancelablePromise<{
        /**
         * Project item ID
         */
        id: number;
        /**
         * Project ID
         */
        projectId: number;
        /**
         * Issue ID
         */
        issueId: number;
        /**
         * Position in project
         */
        position: number;
        /**
         * Item view metadata
         */
        viewMeta: {
            column?: string;
        } | null;
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
    }> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/projects/{id}/items/{issueId}',
            path: {
                'id': id,
                'issueId': issueId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Default Response`,
                404: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * Remove item from project
     * Remove an issue from a project (issue itself remains intact)
     * @param id Project ID
     * @param issueId Issue ID
     * @returns void
     * @throws ApiError
     */
    public static removeProjectItem(
        id: string,
        issueId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/projects/{id}/items/{issueId}',
            path: {
                'id': id,
                'issueId': issueId,
            },
            errors: {
                404: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * Get projects for issue
     * Get all projects associated with an issue
     * @param id
     * @returns any Default Response
     * @throws ApiError
     */
    public static getProjectsForIssue(
        id: string,
    ): CancelablePromise<Array<{
        /**
         * Unique project ID
         */
        id: number;
        /**
         * Project name
         */
        name: string;
        /**
         * Project description
         */
        description: string | null;
        /**
         * Project status
         */
        status: 'planned' | 'active' | 'paused' | 'done' | 'canceled';
        /**
         * Start date (YYYY-MM-DD)
         */
        startDate: string | null;
        /**
         * End date (YYYY-MM-DD)
         */
        endDate: string | null;
        /**
         * View configuration
         */
        viewMeta: {
            /**
             * View type: board or table
             */
            viewType: 'board' | 'table';
            /**
             * Column names for board view
             */
            columns?: Array<string>;
        };
        /**
         * Creation timestamp
         */
        createdAt: string;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/issues/{id}/projects',
            path: {
                'id': id,
            },
            errors: {
                500: `Default Response`,
            },
        });
    }
}
