/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class LinksService {
    /**
     * Create link
     * Create a link between two issues
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createLink(
        requestBody: {
            /**
             * Source issue ID
             */
            sourceIssueId: number;
            /**
             * Target issue ID
             */
            targetIssueId: number;
            /**
             * Type of relationship between issues
             */
            linkType: 'parent' | 'child' | 'relates' | 'derived_from';
        },
    ): CancelablePromise<{
        /**
         * Unique link ID
         */
        id: number;
        /**
         * Source issue ID
         */
        sourceIssueId: number;
        /**
         * Target issue ID
         */
        targetIssueId: number;
        /**
         * Type of relationship
         */
        linkType: 'parent' | 'child' | 'relates' | 'derived_from';
        /**
         * Creation timestamp
         */
        createdAt: string;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/links',
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
     * List issue links
     * List all links for a given issue with direction
     * @param id Issue ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static listIssueLinks(
        id: string,
    ): CancelablePromise<Array<{
        /**
         * Unique link ID
         */
        id: number;
        /**
         * Source issue ID
         */
        sourceIssueId: number;
        /**
         * Target issue ID
         */
        targetIssueId: number;
        /**
         * Type of relationship
         */
        linkType: 'parent' | 'child' | 'relates' | 'derived_from';
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Link direction relative to the queried issue
         */
        direction: 'outgoing' | 'incoming';
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/issues/{id}/links',
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
     * Delete link
     * Delete a link by ID
     * @param id Link ID
     * @returns void
     * @throws ApiError
     */
    public static deleteLink(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/links/{id}',
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
