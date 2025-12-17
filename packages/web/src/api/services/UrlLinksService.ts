/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UrlLinksService {
    /**
     * Create URL link
     * Create an external URL link for an issue
     * @param id
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createUrlLink(
        id: string,
        requestBody: {
            /**
             * External URL
             */
            url: string;
            /**
             * Display title
             */
            title?: string;
        },
    ): CancelablePromise<{
        /**
         * Unique URL link ID
         */
        id: number;
        /**
         * Parent issue ID
         */
        issueId: number;
        /**
         * External URL
         */
        url: string;
        /**
         * Display title
         */
        title: string | null;
        /**
         * Creation timestamp
         */
        createdAt: string;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/issues/{id}/url-links',
            path: {
                'id': id,
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
     * List URL links
     * List all external URL links for a given issue
     * @param id
     * @returns any Default Response
     * @throws ApiError
     */
    public static listUrlLinks(
        id: string,
    ): CancelablePromise<Array<{
        /**
         * Unique URL link ID
         */
        id: number;
        /**
         * Parent issue ID
         */
        issueId: number;
        /**
         * External URL
         */
        url: string;
        /**
         * Display title
         */
        title: string | null;
        /**
         * Creation timestamp
         */
        createdAt: string;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/issues/{id}/url-links',
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
     * Update URL link
     * Update a URL link title
     * @param id
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static updateUrlLink(
        id: string,
        requestBody: {
            /**
             * Display title (null to clear)
             */
            title: string | null;
        },
    ): CancelablePromise<{
        /**
         * Unique URL link ID
         */
        id: number;
        /**
         * Parent issue ID
         */
        issueId: number;
        /**
         * External URL
         */
        url: string;
        /**
         * Display title
         */
        title: string | null;
        /**
         * Creation timestamp
         */
        createdAt: string;
    }> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/url-links/{id}',
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
     * Delete URL link
     * Delete a URL link by ID
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static deleteUrlLink(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/url-links/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
                500: `Default Response`,
            },
        });
    }
}
