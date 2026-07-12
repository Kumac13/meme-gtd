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
             * Original URL (present for web-saved articles; omit for manual creation)
             */
            originalUrl?: string;
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
         * How the article came to be: saved from the web or written by hand (issues.origin)
         */
        origin: 'web' | 'manual';
        /**
         * Article metadata
         */
        meta: {
            /**
             * Original URL (absent for manually created articles)
             */
            originalUrl?: string;
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
     * @param label Filter by label name(s). Supports comma-separated values for OR logic (e.g., wine,book)
     * @param projectId Filter by project ID(s). Supports comma-separated values for OR logic (e.g., 1,2,3)
     * @param bookmarked Filter by bookmark status
     * @param origin Filter by origin: saved from the web or created manually
     * @returns any Default Response
     * @throws ApiError
     */
    public static listArticles(
        limit?: number,
        offset?: number,
        search?: string,
        label?: string,
        projectId?: string,
        bookmarked?: 'true' | 'false',
        origin?: 'web' | 'manual',
    ): CancelablePromise<{
        /**
         * Array of articles
         */
        data: Array<{
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
             * How the article came to be: saved from the web or written by hand (issues.origin)
             */
            origin: 'web' | 'manual';
            /**
             * Article metadata
             */
            meta: {
                /**
                 * Original URL (absent for manually created articles)
                 */
                originalUrl?: string;
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
        }>;
        /**
         * Total count of articles matching the filters (ignoring pagination)
         */
        total: number;
        /**
         * Maximum number of articles returned per page
         */
        limit: number;
        /**
         * Number of articles skipped
         */
        offset: number;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/articles/',
            query: {
                'limit': limit,
                'offset': offset,
                'search': search,
                'label': label,
                'projectId': projectId,
                'bookmarked': bookmarked,
                'origin': origin,
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
         * How the article came to be: saved from the web or written by hand (issues.origin)
         */
        origin: 'web' | 'manual';
        /**
         * Article metadata
         */
        meta: {
            /**
             * Original URL (absent for manually created articles)
             */
            originalUrl?: string;
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
     * Update article
     * Update a manually created article's title/body. Web-saved articles are read-only (400).
     * @param id Article ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static updateArticle(
        id: string,
        requestBody?: {
            /**
             * Article title
             */
            title?: string;
            /**
             * Article content in Markdown format
             */
            bodyMd?: string;
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
         * How the article came to be: saved from the web or written by hand (issues.origin)
         */
        origin: 'web' | 'manual';
        /**
         * Article metadata
         */
        meta: {
            /**
             * Original URL (absent for manually created articles)
             */
            originalUrl?: string;
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
            method: 'PATCH',
            url: '/api/articles/{id}',
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
    /**
     * Bookmark article
     * Bookmark article
     * @param id Article ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static bookmarkArticle(
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
         * How the article came to be: saved from the web or written by hand (issues.origin)
         */
        origin: 'web' | 'manual';
        /**
         * Article metadata
         */
        meta: {
            /**
             * Original URL (absent for manually created articles)
             */
            originalUrl?: string;
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
            url: '/api/articles/{id}/bookmark',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Unbookmark article
     * Unbookmark article
     * @param id Article ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static unbookmarkArticle(
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
         * How the article came to be: saved from the web or written by hand (issues.origin)
         */
        origin: 'web' | 'manual';
        /**
         * Article metadata
         */
        meta: {
            /**
             * Original URL (absent for manually created articles)
             */
            originalUrl?: string;
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
            url: '/api/articles/{id}/unbookmark',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
}
