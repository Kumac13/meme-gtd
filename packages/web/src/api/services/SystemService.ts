/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SystemService {
    /**
     * Health check
     * Report server and database health. Returns 200 when healthy, 503 when the database is unreachable.
     * @returns any Default Response
     * @throws ApiError
     */
    public static getHealth(): CancelablePromise<{
        /**
         * Overall server health
         */
        status: 'ok' | 'error';
        /**
         * API server version
         */
        version: string;
        /**
         * Process uptime in seconds
         */
        uptimeSeconds: number;
        /**
         * Current server time (ISO 8601)
         */
        timestamp: string;
        /**
         * Database health details
         */
        db: {
            /**
             * Database connectivity
             */
            status: 'ok' | 'error';
            /**
             * Latest applied migration version, null if unavailable
             */
            schemaVersion: string | null;
        };
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/health',
            errors: {
                503: `Default Response`,
            },
        });
    }
}
