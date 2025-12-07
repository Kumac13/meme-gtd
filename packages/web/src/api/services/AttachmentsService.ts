/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AttachmentsService {
    /**
     * Upload an image attachment
     * Upload an image attachment (PNG, JPEG, GIF, WebP). Max size: 10MB.
     * @returns any Default Response
     * @throws ApiError
     */
    public static uploadAttachment(): CancelablePromise<{
        /**
         * UUID of the uploaded image
         */
        id: string;
        /**
         * Saved filename (uuid.ext format)
         */
        filename: string;
        /**
         * Absolute path to the image file
         */
        absolutePath: string;
        /**
         * Markdown image reference for editor insertion
         */
        markdownRef: string;
        /**
         * MIME type of the image
         */
        mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
        /**
         * File size in bytes
         */
        size: number;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/attachments',
            errors: {
                400: `Default Response`,
                500: `Default Response`,
            },
        });
    }
    /**
     * Get an attachment image
     * Get an attachment image file by filename
     * @param filename Attachment filename (uuid.ext format)
     * @returns binary Image file binary data
     * @throws ApiError
     */
    public static getAttachment(
        filename: string,
    ): CancelablePromise<Blob> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/attachments/{filename}',
            path: {
                'filename': filename,
            },
            errors: {
                404: `Default Response`,
                500: `Default Response`,
            },
        });
    }
}
