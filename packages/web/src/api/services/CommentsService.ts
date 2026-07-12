/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CommentsService {
    /**
     * List memo comments
     * List all comments for a memo
     * @param memoId Memo ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static listMemoComments(
        memoId: string,
    ): CancelablePromise<Array<{
        /**
         * Unique comment ID
         */
        id: number;
        /**
         * ID of the parent issue (memo or task)
         */
        issueId: number;
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
            url: '/api/memos/{memoId}/comments',
            path: {
                'memoId': memoId,
            },
            errors: {
                400: `Default Response`,
            },
        });
    }
    /**
     * Create memo comment
     * Create comment on memo
     * @param memoId Memo ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createMemoComment(
        memoId: string,
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
         * ID of the parent issue (memo or task)
         */
        issueId: number;
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
            url: '/api/memos/{memoId}/comments',
            path: {
                'memoId': memoId,
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
     * Update memo comment
     * Update comment on memo
     * @param memoId Memo ID
     * @param commentId Comment ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static updateMemoComment(
        memoId: string,
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
         * ID of the parent issue (memo or task)
         */
        issueId: number;
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
            url: '/api/memos/{memoId}/comments/{commentId}',
            path: {
                'memoId': memoId,
                'commentId': commentId,
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
     * Delete memo comment
     * Delete comment from memo
     * @param memoId Memo ID
     * @param commentId Comment ID
     * @returns void
     * @throws ApiError
     */
    public static deleteMemoComment(
        memoId: string,
        commentId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/memos/{memoId}/comments/{commentId}',
            path: {
                'memoId': memoId,
                'commentId': commentId,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * List task comments
     * List all comments for a task
     * @param taskId Task ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static listTaskComments(
        taskId: string,
    ): CancelablePromise<Array<{
        /**
         * Unique comment ID
         */
        id: number;
        /**
         * ID of the parent issue (memo or task)
         */
        issueId: number;
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
            url: '/api/tasks/{taskId}/comments',
            path: {
                'taskId': taskId,
            },
            errors: {
                400: `Default Response`,
            },
        });
    }
    /**
     * Create task comment
     * Create comment on task
     * @param taskId Task ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createTaskComment(
        taskId: string,
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
         * ID of the parent issue (memo or task)
         */
        issueId: number;
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
            url: '/api/tasks/{taskId}/comments',
            path: {
                'taskId': taskId,
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
     * Update task comment
     * Update comment on task
     * @param taskId Task ID
     * @param commentId Comment ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static updateTaskComment(
        taskId: string,
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
         * ID of the parent issue (memo or task)
         */
        issueId: number;
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
            url: '/api/tasks/{taskId}/comments/{commentId}',
            path: {
                'taskId': taskId,
                'commentId': commentId,
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
     * Delete task comment
     * Delete comment from task
     * @param taskId Task ID
     * @param commentId Comment ID
     * @returns void
     * @throws ApiError
     */
    public static deleteTaskComment(
        taskId: string,
        commentId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/tasks/{taskId}/comments/{commentId}',
            path: {
                'taskId': taskId,
                'commentId': commentId,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
    /**
     * List article comments
     * List all comments for an article
     * @param articleId Article ID
     * @returns any Default Response
     * @throws ApiError
     */
    public static listArticleComments(
        articleId: string,
    ): CancelablePromise<Array<{
        /**
         * Unique comment ID
         */
        id: number;
        /**
         * ID of the parent issue (memo or task)
         */
        issueId: number;
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
            url: '/api/articles/{articleId}/comments',
            path: {
                'articleId': articleId,
            },
            errors: {
                400: `Default Response`,
            },
        });
    }
    /**
     * Create article comment
     * Create comment on article
     * @param articleId Article ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static createArticleComment(
        articleId: string,
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
         * ID of the parent issue (memo or task)
         */
        issueId: number;
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
            url: '/api/articles/{articleId}/comments',
            path: {
                'articleId': articleId,
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
     * Update article comment
     * Update comment on article
     * @param articleId Article ID
     * @param commentId Comment ID
     * @param requestBody
     * @returns any Default Response
     * @throws ApiError
     */
    public static updateArticleComment(
        articleId: string,
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
         * ID of the parent issue (memo or task)
         */
        issueId: number;
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
            url: '/api/articles/{articleId}/comments/{commentId}',
            path: {
                'articleId': articleId,
                'commentId': commentId,
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
     * Delete article comment
     * Delete comment from article
     * @param articleId Article ID
     * @param commentId Comment ID
     * @returns void
     * @throws ApiError
     */
    public static deleteArticleComment(
        articleId: string,
        commentId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/articles/{articleId}/comments/{commentId}',
            path: {
                'articleId': articleId,
                'commentId': commentId,
            },
            errors: {
                404: `Default Response`,
            },
        });
    }
}
