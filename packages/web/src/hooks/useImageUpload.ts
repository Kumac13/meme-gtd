import { useState, useCallback } from 'react';

/**
 * Allowed image MIME types
 */
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

/**
 * Maximum file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Response from the attachment upload API
 */
export interface AttachmentResponse {
  id: string;
  filename: string;
  absolutePath: string;
  markdownRef: string;
  mimeType: string;
  size: number;
}

/**
 * Error response from the attachment upload API
 */
export interface AttachmentError {
  error: string;
  code: string;
  message: string;
}

/**
 * Upload state
 */
export interface UseImageUploadState {
  isUploading: boolean;
  error: string | null;
}

/**
 * Upload result
 */
export interface UploadResult {
  success: boolean;
  markdownRef?: string;
  error?: string;
}

/**
 * Validate file before upload
 */
function validateFile(file: File): string | null {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    return 'PNG, JPEG, GIF, WebP形式のみ対応しています';
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return 'ファイルサイズが10MBを超えています';
  }

  return null;
}

/**
 * Hook for uploading images to the attachment API
 */
export function useImageUpload() {
  const [state, setState] = useState<UseImageUploadState>({
    isUploading: false,
    error: null,
  });

  /**
   * Upload an image file
   * @param issueId - The issue ID to attach the image to
   * @param file - The file to upload
   * @returns Upload result with markdown reference or error
   */
  const uploadImage = useCallback(async (
    issueId: number,
    file: File
  ): Promise<UploadResult> => {
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setState({ isUploading: false, error: validationError });
      return { success: false, error: validationError };
    }

    // Start upload
    setState({ isUploading: true, error: null });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/attachments/${issueId}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData: AttachmentError = await response.json();
        setState({ isUploading: false, error: errorData.message });
        return { success: false, error: errorData.message };
      }

      const data: AttachmentResponse = await response.json();
      setState({ isUploading: false, error: null });
      return { success: true, markdownRef: data.markdownRef };
    } catch (error) {
      const message = '画像のアップロードに失敗しました。再度お試しください';
      setState({ isUploading: false, error: message });
      return { success: false, error: message };
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    uploadImage,
    clearError,
  };
}
