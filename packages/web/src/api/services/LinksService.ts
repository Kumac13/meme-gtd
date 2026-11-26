/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class LinksService {
    /**
     * Get the issue link graph
     * Read the active issue graph in one snapshot. Reachability is computed before filters, and the root is always included.
     * @param rootId Start from this active Task, Memo or Article
     * @param depth Maximum distance from rootId. Omit for all reachable issues
     * @param q Partial match in title, Markdown body or non-deleted comments
     * @param label Comma-separated label names (OR)
     * @param projectId Comma-separated positive project IDs or none (OR)
     * @param bookmarked Filter to bookmarked issues
     * @param includeLabels Include actual label memberships for the returned issues
     * @returns any Default Response
     * @throws ApiError
     */
    public static getLinksGraph(
        rootId?: number,
        depth?: number,
        q?: string,
        label?: string,
        projectId?: string,
        bookmarked?: 'true' | 'false',
        includeLabels?: 'true' | 'false',
    ): CancelablePromise<{
        rootId: number | null;
        depth: number | null;
        nodes: Array<{
            id: number;
            type: 'task' | 'memo' | 'article';
            title: string;
            status: string | null;
        }>;
        edges: Array<{
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
        }>;
        labels: Array<{
            id: number;
            name: string;
        }>;
        memberships: Array<{
            issueId: number;
            labelId: number;
        }>;
        truncated: boolean;
        limits: {
            issueNodes: number;
            issueEdges: number;
            labelNodes: number;
            memberships: number;
        };
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/links/graph',
            query: {
                'rootId': rootId,
                'depth': depth,
                'q': q,
                'label': label,
                'projectId': projectId,
                'bookmarked': bookmarked,
                'includeLabels': includeLabels,
            },
            errors: {
                400: `Default Response`,
                404: `Default Response`,
                500: `Default Response`,
            },
        });
    }
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
            /**
             * Set to true only by the memo→task promotion flow so a memo.promoted activity event is recorded. Manual link creation must leave this unset.
             */
            isPromotion?: boolean;
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
     * List all links for a given issue with direction. Optionally filter by link type using ?type= query parameter.
     * @param id Issue ID
     * @param type Filter by link type
     * @returns any Default Response
     * @throws ApiError
     */
    public static listIssueLinks(
        id: string,
        type?: 'parent' | 'child' | 'relates' | 'derived_from',
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
        /**
         * Information about the target issue in this link
         */
        targetIssue: {
            /**
             * Target issue ID
             */
            id: number;
            /**
             * Target issue type
             */
            type: 'memo' | 'task' | 'article';
            /**
             * Target issue title (task title or memo body preview)
             */
            title: string;
            /**
             * Target issue status (null for memos)
             */
            status: string | null;
        };
    }>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/issues/{id}/links',
            path: {
                'id': id,
            },
            query: {
                'type': type,
            },
            errors: {
                400: `Default Response`,
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
