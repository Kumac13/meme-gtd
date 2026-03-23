/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SearchService {
    /**
     * Keyword search
     * Search issues by keyword using partial text matching across title, body, and comments
     * @param q Search query text
     * @param limit Maximum number of results to return
     * @param offset Pagination offset
     * @param types Comma-separated issue types to include (memo,task,article)
     * @param status Filter by issue status (e.g., open, done)
     * @param label Filter by label names (comma-separated, OR logic)
     * @param bookmarked Filter by bookmarked status (set to "true" to show only bookmarked)
     * @param order Sort order by updated_at
     * @returns any Default Response
     * @throws ApiError
     */
    public static keywordSearch(
        q: string,
        limit: number = 20,
        offset?: number,
        types?: string,
        status?: string,
        label?: string,
        bookmarked?: string,
        order: 'asc' | 'desc' = 'desc',
    ): CancelablePromise<{
        /**
         * Search results grouped by issue
         */
        results: Array<{
            /**
             * Issue ID
             */
            id: number;
            /**
             * Issue type (memo, task, article)
             */
            type: string;
            /**
             * Issue title
             */
            title: string | null;
            /**
             * Issue body in Markdown
             */
            bodyMd: string;
            /**
             * Issue status
             */
            status: string | null;
            /**
             * Whether the issue is bookmarked
             */
            isBookmarked: boolean;
            /**
             * Labels assigned to the issue
             */
            labels: Array<string>;
            /**
             * Number of comments
             */
            commentCount: number;
            /**
             * Creation timestamp
             */
            createdAt: string;
            /**
             * Last update timestamp
             */
            updatedAt: string;
            /**
             * Match details
             */
            matches: Array<{
                /**
                 * Where the match was found
                 */
                field: 'issue' | 'comment';
                /**
                 * Comment ID if match is in a comment
                 */
                commentId: number | null;
                /**
                 * Matched text
                 */
                text: string;
            }>;
        }>;
        /**
         * Total number of results
         */
        total: number;
        /**
         * Page size
         */
        limit: number;
        /**
         * Current offset
         */
        offset: number;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/search/keyword',
            query: {
                'q': q,
                'limit': limit,
                'offset': offset,
                'types': types,
                'status': status,
                'label': label,
                'bookmarked': bookmarked,
                'order': order,
            },
        });
    }
    /**
     * Semantic search
     * Search issues by semantic similarity using vector embeddings
     * @param q Search query text
     * @param limit Maximum number of results to return
     * @param types Comma-separated issue types to include (memo,task,article)
     * @returns any Default Response
     * @throws ApiError
     */
    public static semanticSearch(
        q: string,
        limit: number = 20,
        types?: string,
    ): CancelablePromise<{
        /**
         * Search results sorted by relevance
         */
        results: Array<{
            issue: {
                /**
                 * Issue ID
                 */
                id: number;
                /**
                 * Issue type (memo, task, article)
                 */
                type: string;
                /**
                 * Issue title
                 */
                title: string | null;
                /**
                 * Issue body in Markdown
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
            };
            /**
             * Combined relevance score
             */
            score: number;
            /**
             * Vector similarity score
             */
            vectorScore: number;
            /**
             * Reasons for the match
             */
            matchReason: Array<string>;
        }>;
        meta: {
            /**
             * Original search query
             */
            query: string;
            /**
             * Total number of results returned
             */
            totalResults: number;
            /**
             * Search duration in milliseconds
             */
            searchTimeMs: number;
        };
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/search/semantic',
            query: {
                'q': q,
                'limit': limit,
                'types': types,
            },
            errors: {
                503: `Default Response`,
            },
        });
    }
}
