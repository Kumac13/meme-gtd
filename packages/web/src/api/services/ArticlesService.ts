/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ArticlesService {
    /**
     * Create article
     * Create a new article
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createArticle(
        requestBody: {
            /**
             * Article title
             */
            title: string;
            /**
             * Article content in Markdown format
             */
            bodyMd: string;
            /**
             * Original URL of the article
             */
            originalUrl: string;
            /**
             * Name of the source site
             */
            siteName?: string | null;
            /**
             * Array of label names to assign
             */
            labels?: Array<string>;
        },
    ): CancelablePromise<{
        /**
         * Unique article ID
         */
        id: number;
        /**
         * Issue type (always "article")
         */
        type: 'article';
        /**
         * Article title
         */
        title: string;
        /**
         * Article content in Markdown format
         */
        bodyMd: string;
        /**
         * Article metadata
         */
        meta: {
            /**
             * Original URL of the article
             */
            originalUrl: string;
            /**
             * Name of the source site
             */
            siteName?: string | null;
            /**
             * Timestamp when the article was archived
             */
            archivedAt: string;
        };
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Whether the article is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the article is soft-deleted
         */
        isDeleted: boolean;
        /**
         * Array of label names assigned to this article
         */
        labels?: Array<string>;
        /**
         * Number of comments on this article
         */
        commentCount?: number;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/articles/',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Default Response`,
            },
        });
    }
    /**
     * List articles
     * List all articles with optional filters
     * @param limit Maximum number of articles to return
     * @param offset Number of articles to skip
     * @param search Search articles by title or content
     * @returns any Default Response
     * @throws ApiError
     */
    public static listArticles(
        limit?: number,
        offset?: number,
        search?: string,
    ): CancelablePromise<Array<{
        /**
         * Unique article ID
         */
        id: number;
        /**
         * Issue type (always "article")
         */
        type: 'article';
        /**
         * Article title
         */
        title: string;
        /**
         * Article content in Markdown format
         */
        bodyMd: string;
        /**
         * Article metadata
         */
        meta: {
            /**
             * Original URL of the article
             */
            originalUrl: string;
            /**
             * Name of the source site
             */
            siteName?: string | null;
            /**
             * Timestamp when the article was archived
             */
            archivedAt: string;
        };
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Whether the article is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the article is soft-deleted
         */
        isDeleted: boolean;
        /**
         * Array of label names assigned to this article
         */
        labels?: Array<string>;
        /**
         * Number of comments on this article
         */
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
            errors: {
                400: `Default Response`,
            },
        });
    }
    /**
     * Get article
     * Get article by ID
     * @param id Article ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static getArticle(
        id: string,
    ): CancelablePromise<{
        /**
         * Unique article ID
         */
        id: number;
        /**
         * Issue type (always "article")
         */
        type: 'article';
        /**
         * Article title
         */
        title: string;
        /**
         * Article content in Markdown format
         */
        bodyMd: string;
        /**
         * Article metadata
         */
        meta: {
            /**
             * Original URL of the article
             */
            originalUrl: string;
            /**
             * Name of the source site
             */
            siteName?: string | null;
            /**
             * Timestamp when the article was archived
             */
            archivedAt: string;
        };
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Whether the article is bookmarked
         */
        isBookmarked: boolean;
        /**
         * Whether the article is soft-deleted
         */
        isDeleted: boolean;
        /**
         * Array of label names assigned to this article
         */
        labels?: Array<string>;
        /**
         * Number of comments on this article
         */
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
     * Delete article
     * Delete article (soft delete)
     * @param id Article ID
     * @returns void
     * @throws ApiError
     */
    public static deleteArticle(
        id: string,
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
