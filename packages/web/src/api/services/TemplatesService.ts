/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TemplatesService {
    /**
     * Create template
     * Create a new creation-time template
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createTemplate(
        requestBody: {
            /**
             * Template name
             */
            title: string;
            /**
             * Template body skeleton in Markdown, copied into the new issue
             */
            bodyMd: string;
            /**
             * Issue type the template produces when applied
             */
            templateTarget: 'task' | 'article';
            /**
             * Label names preset on the template (copied on apply)
             */
            labels?: Array<string>;
            /**
             * Project ids preset on the template (copied on apply)
             */
            projectIds?: Array<number>;
        },
    ): CancelablePromise<{
        /**
         * Unique template ID
         */
        id: number;
        /**
         * Issue type (always "template")
         */
        type: 'template';
        /**
         * Issue type the template produces when applied
         */
        templateTarget: 'task' | 'article';
        /**
         * Template name
         */
        title: string | null;
        /**
         * Template body skeleton in Markdown
         */
        bodyMd: string;
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Whether the template is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the template is soft-deleted
         */
        isDeleted: boolean;
        /**
         * Label names preset on the template
         */
        labels?: Array<string>;
        /**
         * Project ids preset on the template
         */
        projectIds?: Array<number>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/templates/',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Default Response`,
            },
        });
    }
    /**
     * List templates
     * List templates with optional filters (target/search)
     * @param limit Maximum number of templates to return
     * @param offset Number of templates to skip
     * @param search Search templates by title or body
     * @param target Restrict to templates producing this issue type
     * @returns any Default Response
     * @throws ApiError
     */
    public static listTemplates(
        limit?: number,
        offset?: number,
        search?: string,
        target?: 'task' | 'article',
    ): CancelablePromise<{
        /**
         * Array of templates
         */
        data: Array<{
            /**
             * Unique template ID
             */
            id: number;
            /**
             * Issue type (always "template")
             */
            type: 'template';
            /**
             * Issue type the template produces when applied
             */
            templateTarget: 'task' | 'article';
            /**
             * Template name
             */
            title: string | null;
            /**
             * Template body skeleton in Markdown
             */
            bodyMd: string;
            /**
             * Creation timestamp
             */
            createdAt: string;
            /**
             * Last update timestamp
             */
            updatedAt: string;
            /**
             * Whether the template is bookmarked
             */
            isBookmarked: boolean;
            /**
             * Whether the template is soft-deleted
             */
            isDeleted: boolean;
            /**
             * Label names preset on the template
             */
            labels?: Array<string>;
            /**
             * Project ids preset on the template
             */
            projectIds?: Array<number>;
        }>;
        /**
         * Total count of templates matching the filters (ignoring pagination)
         */
        total: number;
        /**
         * Maximum number of templates returned per page
         */
        limit: number;
        /**
         * Number of templates skipped
         */
        offset: number;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/templates/',
            query: {
                'limit': limit,
                'offset': offset,
                'search': search,
                'target': target,
            },
            errors: {
                400: `Default Response`,
            },
        });
    }
    /**
     * Get template
     * Get template by ID
     * @param id Template ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static getTemplate(
        id: string,
    ): CancelablePromise<{
        /**
         * Unique template ID
         */
        id: number;
        /**
         * Issue type (always "template")
         */
        type: 'template';
        /**
         * Issue type the template produces when applied
         */
        templateTarget: 'task' | 'article';
        /**
         * Template name
         */
        title: string | null;
        /**
         * Template body skeleton in Markdown
         */
        bodyMd: string;
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Whether the template is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the template is soft-deleted
         */
        isDeleted: boolean;
        /**
         * Label names preset on the template
         */
        labels?: Array<string>;
        /**
         * Project ids preset on the template
         */
        projectIds?: Array<number>;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/templates/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Update template
     * Update a template's fields, labels and projects
     * @param id Template ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static updateTemplate(
        id: string,
        requestBody?: {
            /**
             * Template name
             */
            title?: string;
            /**
             * Template body skeleton in Markdown
             */
            bodyMd?: string;
            /**
             * Issue type the template produces when applied
             */
            templateTarget?: 'task' | 'article';
            /**
             * Label names (full replacement)
             */
            labels?: Array<string>;
            /**
             * Project ids (full replacement)
             */
            projectIds?: Array<number>;
        },
    ): CancelablePromise<{
        /**
         * Unique template ID
         */
        id: number;
        /**
         * Issue type (always "template")
         */
        type: 'template';
        /**
         * Issue type the template produces when applied
         */
        templateTarget: 'task' | 'article';
        /**
         * Template name
         */
        title: string | null;
        /**
         * Template body skeleton in Markdown
         */
        bodyMd: string;
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Whether the template is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the template is soft-deleted
         */
        isDeleted: boolean;
        /**
         * Label names preset on the template
         */
        labels?: Array<string>;
        /**
         * Project ids preset on the template
         */
        projectIds?: Array<number>;
    }> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/templates/{id}',
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
     * Delete template
     * Delete template (soft delete)
     * @param id Template ID
     * @returns void
     * @throws ApiError
     */
    public static deleteTemplate(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/templates/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
}
