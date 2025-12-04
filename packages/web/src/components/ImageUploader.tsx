import { useState, useCallback, useRef, DragEvent } from 'react';
import { useImageUpload } from '../hooks/useImageUpload';

interface ImageUploaderProps {
  /**
   * The issue ID to attach the image to
   */
  issueId: number;
  /**
   * Callback when upload completes successfully
   * @param markdownRef - The markdown reference to insert (e.g., "![image](/path/to/file)")
   */
  onUploadComplete: (markdownRef: string) => void;
  /**
   * Whether the uploader is disabled
   */
  disabled?: boolean;
}

/**
 * Image uploader component with drag & drop and file selection support
 */
export function ImageUploader({ issueId, onUploadComplete, disabled = false }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isUploading, error, uploadImage, clearError } = useImageUpload();

  const handleFile = useCallback(async (file: File) => {
    if (disabled || isUploading) return;

    clearError();
    const result = await uploadImage(issueId, file);

    if (result.success && result.markdownRef) {
      onUploadComplete(result.markdownRef);
    }
  }, [issueId, disabled, isUploading, uploadImage, clearError, onUploadComplete]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [disabled, isUploading, handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [handleFile]);

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isUploading]);

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${isDragging
            ? 'border-github-green-500 bg-github-green-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-github-green-600"></div>
            <span className="text-sm text-gray-600">アップロード中...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg
              className={`w-8 h-8 ${isDragging ? 'text-github-green-500' : 'text-gray-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <div className="text-sm">
              <span className="text-github-green-600 font-medium">クリックして選択</span>
              <span className="text-gray-500"> または ドラッグ＆ドロップ</span>
            </div>
            <p className="text-xs text-gray-400">
              PNG, JPEG, GIF, WebP (最大10MB)
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
