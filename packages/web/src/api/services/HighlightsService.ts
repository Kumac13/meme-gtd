/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HighlightsService {
    /**
     * List article highlights
     * List all highlights on an article
     * @param id Article ID
     * @returns any Array of highlights for an article
     * @throws ApiError
     */
    public static listArticleHighlights(
        id: string,
    ): CancelablePromise<Array<{
        /**
         * Unique highlight ID
         */
        id: number;
        /**
         * ID of the article this highlight belongs to
         */
        issueId: number;
        /**
         * The highlighted text
         */
        exact: string;
        /**
         * Context before the quote
         */
        prefix?: string;
        /**
         * Context after the quote
         */
        suffix?: string;
        /**
         * Highlight color key
         */
        color: string;
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Number of comments on this highlight
         */
        commentCount?: number;
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/articles/{id}/highlights',
            path: {
                'id': id,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Create article highlight
     * Create a highlight on an article using a TextQuoteSelector anchor
     * @param id Article ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createArticleHighlight(
        id: string,
        requestBody: {
            /**
             * The highlighted text (TextQuoteSelector.exact)
             */
            exact: string;
            /**
             * Text immediately before the quote (disambiguates repeats)
             */
            prefix?: string;
            /**
             * Text immediately after the quote
             */
            suffix?: string;
            /**
             * Highlight color key (defaults to "green")
             */
            color?: string;
        },
    ): CancelablePromise<{
        /**
         * Unique highlight ID
         */
        id: number;
        /**
         * ID of the article this highlight belongs to
         */
        issueId: number;
        /**
         * The highlighted text
         */
        exact: string;
        /**
         * Context before the quote
         */
        prefix?: string;
        /**
         * Context after the quote
         */
        suffix?: string;
        /**
         * Highlight color key
         */
        color: string;
        /**
         * Creation timestamp
         */
        createdAt: string;
        /**
         * Last update timestamp
         */
        updatedAt: string;
        /**
         * Number of comments on this highlight
         */
        commentCount?: number;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/articles/{id}/highlights',
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
     * Delete article highlight
     * Delete a highlight (soft delete). Its comments are soft-deleted too.
     * @param id Article ID
     * @param highlightId Highlight ID
     * @returns void
     * @throws ApiError
     */
    public static deleteArticleHighlight(
        id: string,
        highlightId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/articles/{id}/highlights/{highlightId}',
            path: {
                'id': id,
                'highlightId': highlightId,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * List highlight comments
     * List comments on a highlight
     * @param id Article ID
     * @param highlightId Highlight ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static listHighlightComments(
        id: string,
        highlightId: string,
    ): CancelablePromise<Array<{
        /**
         * Unique comment ID
         */
        id: number;
        /**
         * ID of the parent issue (memo, task, or article)
         */
        issueId: number;
        /**
         * ID of the article highlight this comment annotates (omitted for memo/task comments)
         */
        highlightId?: number;
        /**
         * Comment content in Markdown format
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
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/articles/{id}/highlights/{highlightId}/comments',
            path: {
                'id': id,
                'highlightId': highlightId,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Create highlight comment
     * Add a comment to a highlight
     * @param id Article ID
     * @param highlightId Highlight ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createHighlightComment(
        id: string,
        highlightId: string,
        requestBody: {
            /**
             * Comment content in Markdown format
             */
            bodyMd: string;
        },
    ): CancelablePromise<{
        /**
         * Unique comment ID
         */
        id: number;
        /**
         * ID of the parent issue (memo, task, or article)
         */
        issueId: number;
        /**
         * ID of the article highlight this comment annotates (omitted for memo/task comments)
         */
        highlightId?: number;
        /**
         * Comment content in Markdown format
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
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/articles/{id}/highlights/{highlightId}/comments',
            path: {
                'id': id,
                'highlightId': highlightId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Update highlight comment
     * Update a comment on a highlight
     * @param id Article ID
     * @param highlightId Highlight ID
     * @param commentId Comment ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static updateHighlightComment(
        id: string,
        highlightId: string,
        commentId: string,
        requestBody: {
            /**
             * Updated comment content in Markdown format
             */
            bodyMd: string;
        },
    ): CancelablePromise<{
        /**
         * Unique comment ID
         */
        id: number;
        /**
         * ID of the parent issue (memo, task, or article)
         */
        issueId: number;
        /**
         * ID of the article highlight this comment annotates (omitted for memo/task comments)
         */
        highlightId?: number;
        /**
         * Comment content in Markdown format
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
    }> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/articles/{id}/highlights/{highlightId}/comments/{commentId}',
            path: {
                'id': id,
                'highlightId': highlightId,
                'commentId': commentId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * Delete highlight comment
     * Delete a comment from a highlight
     * @param id Article ID
     * @param highlightId Highlight ID
     * @param commentId Comment ID
     * @returns void
     * @throws ApiError
     */
    public static deleteHighlightComment(
        id: string,
        highlightId: string,
        commentId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/articles/{id}/highlights/{highlightId}/comments/{commentId}',
            path: {
                'id': id,
                'highlightId': highlightId,
                'commentId': commentId,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
}
