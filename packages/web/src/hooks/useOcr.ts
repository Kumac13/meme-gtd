import { useState, useCallback } from 'react';

/**
 * Allowed image MIME types for OCR
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
 * Response from the OCR API
 */
interface OcrResponse {
  text: string;
}

/**
 * Error response from the OCR API
 */
interface OcrErrorResponse {
  error: string;
  code: string;
  message: string;
}

/**
 * OCR processing result
 */
interface OcrResult {
  success: boolean;
  text?: string;
  error?: string;
}

/**
 * Validate file before OCR processing
 */
function validateFile(file: File): string | null {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    return 'Only PNG, JPEG, GIF, WebP formats are supported';
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return 'File size exceeds 10MB limit';
  }

  return null;
}

/**
 * Hook for processing images with OCR
 */
export function useOcr() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Process an image file with OCR
   * @param file - The image file to process
   * @returns OCR result with extracted text or error
   */
  const processImage = useCallback(async (file: File): Promise<OcrResult> => {
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return { success: false, error: validationError };
    }

    // Start processing
    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData: OcrErrorResponse = await response.json();
        setIsProcessing(false);
        setError(errorData.message);
        return { success: false, error: errorData.message };
      }

      const data: OcrResponse = await response.json();
      setIsProcessing(false);
      setError(null);
      return { success: true, text: data.text };
    } catch (err) {
      const message = 'Failed to process image. Please try again.';
      setIsProcessing(false);
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isProcessing,
    error,
    processImage,
    clearError,
  };
}
