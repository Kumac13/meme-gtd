/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class LabelsService {
    /**
     * List labels
     * List all labels
     * @returns any Default Response
     * @throws ApiError
     */
    public static listLabels(): CancelablePromise<Array<{
        /**
         * Unique label ID
         */
        id: number;
        /**
         * Label name
         */
        name: string;
        /**
         * Label description (null if not set)
         */
        description: string | null;
        /**
         * Creation timestamp
         */
        createdAt: string;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/labels',
            errors: {
                400: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * Create label
     * Create a new label
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createLabel(
        requestBody: {
            /**
             * Label name (unique identifier)
             */
            name: string;
            /**
             * Optional label description
             */
            description?: string;
        },
    ): CancelablePromise<{
        /**
         * Unique label ID
         */
        id: number;
        /**
         * Label name
         */
        name: string;
        /**
         * Label description (null if not set)
         */
        description: string | null;
        /**
         * Creation timestamp
         */
        createdAt: string;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/labels',
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
     * Assign label to issue
     * Assign a label to an issue (idempotent)
     * @param issueId Issue ID (memo or task)
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static assignLabelToIssue(
        issueId: string,
        requestBody: {
            /**
             * ID of the label to assign
             */
            labelId: number;
        },
    ): CancelablePromise<{
        success: boolean;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/issues/{issueId}/labels',
            path: {
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
     * Remove label from issue
     * Remove a label assignment from an issue (idempotent)
     * @param issueId Issue ID (memo or task)
     * @param labelId Label ID to remove
     * @returns void
     * @throws ApiError
     */
    public static removeLabelFromIssue(
        issueId: string,
        labelId: number,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/issues/{issueId}/labels/{labelId}',
            path: {
                'issueId': issueId,
                'labelId': labelId,
            },
            errors: {
                404: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * Delete label
     * Delete a label by name
     * @param name Label name
     * @returns void
     * @throws ApiError
     */
    public static deleteLabel(
        name: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/labels/{name}',
            path: {
                'name': name,
            },
            errors: {
                404: `Default Response`,
                500: `Default Response`,
            },
        });
    }
}
