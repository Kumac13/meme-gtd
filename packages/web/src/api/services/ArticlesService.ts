/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ArticlesService {
    /**
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static postApiArticles(
        requestBody: {
            title: string;
            bodyMd: string;
            originalUrl: string;
            siteName?: string;
            labels?: Array<string>;
        },
    ): CancelablePromise<{
        id: number;
        type: 'article';
        title: string;
        bodyMd: string;
        meta: {
            originalUrl: string;
            siteName?: string;
            archivedAt: string;
        };
        createdAt: string;
        updatedAt: string;
        isBookmarked: boolean;
        isDeleted: boolean;
        labels?: Array<string>;
        commentCount?: number;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/articles/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param limit
     * @param offset
     * @param search
     * @returns any Default Response
     * @throws ApiError
     */
    public static getApiArticles(
        limit?: number,
        offset?: number,
        search?: string,
    ): CancelablePromise<Array<{
        id: number;
        type: 'article';
        title: string;
        bodyMd: string;
        meta: {
            originalUrl: string;
            siteName?: string;
            archivedAt: string;
        };
        createdAt: string;
        updatedAt: string;
        isBookmarked: boolean;
        isDeleted: boolean;
        labels?: Array<string>;
        commentCount?: number;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/articles/',
            query: {
                'limit': limit,
                'offset': offset,
                'search': search,
            },
        });
    }
    /**
     * @param id
     * @returns any Default Response
     * @throws ApiError
     */
    public static getApiArticles1(
        id: number,
    ): CancelablePromise<{
        id: number;
        type: 'article';
        title: string;
        bodyMd: string;
        meta: {
            originalUrl: string;
            siteName?: string;
            archivedAt: string;
        };
        createdAt: string;
        updatedAt: string;
        isBookmarked: boolean;
        isDeleted: boolean;
        labels?: Array<string>;
        commentCount?: number;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/articles/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static deleteApiArticles(
        id: number,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/articles/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
}
