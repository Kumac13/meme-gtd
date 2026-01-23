import { useRef, useState, ChangeEvent } from 'react';
import { IoCamera } from 'react-icons/io5';
import { useOcr } from '../hooks/useOcr';
import { useImageUpload } from '../hooks/useImageUpload';

interface OcrCameraButtonProps {
  /** Called when text is extracted from the image */
  onTextExtracted: (text: string) => void;
  /** Called when the user chooses to attach the original image */
  onImageAttached?: (markdownRef: string) => void;
  /** Disable the button */
  disabled?: boolean;
}

/**
 * Camera button for OCR text extraction
 * - Opens camera/file picker for image selection
 * - Processes image with OCR
 * - Optionally attaches original image as markdown
 */
export function OcrCameraButton({
  onTextExtracted,
  onImageAttached,
  disabled = false,
}: OcrCameraButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAttachDialog, setShowAttachDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const { isProcessing, processImage } = useOcr();
  const { isUploading, uploadImage } = useImageUpload();

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again
    e.target.value = '';

    // Process image with OCR
    const result = await processImage(file);

    if (result.success && result.text !== undefined) {
      // Insert extracted text
      onTextExtracted(result.text);

      // If onImageAttached callback is provided, show the dialog
      if (onImageAttached) {
        setPendingFile(file);
        setShowAttachDialog(true);
      }
    }
  };

  const handleAttach = async () => {
    if (!pendingFile || !onImageAttached) return;

    const result = await uploadImage(pendingFile);
    if (result.success && result.markdownRef) {
      onImageAttached(result.markdownRef);
    }

    setPendingFile(null);
    setShowAttachDialog(false);
  };

  const handleSkip = () => {
    setPendingFile(null);
    setShowAttachDialog(false);
  };

  const isDisabled = disabled || isProcessing || isUploading;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        title={isProcessing ? 'Processing...' : 'Extract text from image (OCR)'}
        aria-label="Extract text from image"
      >
        {isProcessing ? (
          <svg
            className="w-5 h-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <IoCamera className="w-5 h-5" />
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Attach dialog */}
      {showAttachDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Attach original image?
            </h3>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleSkip}
                disabled={isUploading}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleAttach}
                disabled={isUploading}
                className="px-4 py-2 text-sm bg-github-green-600 text-white rounded-md hover:bg-github-green-700 disabled:opacity-50"
              >
                {isUploading ? 'Attaching...' : 'Attach'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
