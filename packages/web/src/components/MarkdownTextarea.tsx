/**
 * Markdown textarea with Write/Preview tabs
 * Similar to GitHub's comment input
 */

import { useRef, useState, type RefObject, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { useAutoGrow } from '../hooks/useAutoGrow';
import { useImageUpload } from '../hooks/useImageUpload';
import { MarkdownRenderer } from '../utils/markdown';

interface MarkdownTextareaProps {
  /**
   * Current value of the textarea
   */
  value: string;
  /**
   * Callback when value changes
   */
  onChange: (value: string) => void;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Number of rows for textarea
   */
  rows?: number;
  /**
   * Whether the input is disabled
   */
  disabled?: boolean;
  /**
   * Ref to the textarea element
   */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  /**
   * Callback for keydown events (e.g., Cmd+Enter)
   */
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  /**
   * Callback for paste events (e.g., image paste)
   */
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  /**
   * Callback for dragover events
   */
  onDragOver?: (e: DragEvent<HTMLTextAreaElement>) => void;
  /**
   * Callback for dragleave events
   */
  onDragLeave?: (e: DragEvent<HTMLTextAreaElement>) => void;
  /**
   * Callback for drop events
   */
  onDrop?: (e: DragEvent<HTMLTextAreaElement>) => void;
  /**
   * Whether dragging is active (for visual feedback)
   */
  isDragging?: boolean;
  /**
   * Whether image upload is in progress
   */
  isUploading?: boolean;
  /**
   * ID for the textarea (for label association)
   */
  id?: string;
  /**
   * Minimum height CSS class
   */
  minHeightClass?: string;
}

type TabMode = 'write' | 'preview';

/**
 * Markdown textarea component with Write/Preview tabs
 */
export function MarkdownTextarea({
  value,
  onChange,
  placeholder = 'Enter text in Markdown format...',
  rows = 10,
  disabled = false,
  textareaRef,
  onKeyDown,
  onPaste,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragging = false,
  isUploading = false,
  id,
  minHeightClass = 'min-h-[200px]',
}: MarkdownTextareaProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const resolvedRef = textareaRef ?? internalRef;
  const [mode, setMode] = useState<TabMode>('write');
  const [isImageDragging, setIsImageDragging] = useState(false);
  const imageUpload = useImageUpload();

  useAutoGrow(resolvedRef, value, mode);

  const insertMarkdownRef = (markdownRef: string) => {
    const textarea = resolvedRef.current;
    if (!textarea) {
      onChange(`${value}${value.endsWith('\n') || value === '' ? '' : '\n'}${markdownRef}\n`);
      return;
    }

    const start = textarea.selectionStart;
    const before = value.slice(0, start);
    const separator = before.endsWith('\n') || before === '' ? '' : '\n';
    const nextCursor = before.length + separator.length + markdownRef.length + 1;
    onChange(`${before}${separator}${markdownRef}\n${value.slice(textarea.selectionEnd)}`);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const uploadImage = async (file: File) => {
    if (imageUpload.isUploading) return;
    const result = await imageUpload.uploadImage(file);
    if (result.success && result.markdownRef) insertMarkdownRef(result.markdownRef);
  };

  const handleImagePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    for (const item of event.clipboardData?.items ?? []) {
      if (!item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (!file) return;
      event.preventDefault();
      void uploadImage(file);
      return;
    }
  };

  const handleImageDragOver = (event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    if (event.dataTransfer.types.includes('Files')) setIsImageDragging(true);
  };

  const handleImageDragLeave = (event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setIsImageDragging(false);
  };

  const handleImageDrop = (event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setIsImageDragging(false);
    const file = event.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) void uploadImage(file);
  };

  const uploading = isUploading || imageUpload.isUploading;
  const dragging = isDragging || isImageDragging;

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden">
      {/* Tab header */}
      <div className="flex border-b border-gray-300 bg-gray-50">
        <button
          type="button"
          onClick={() => setMode('write')}
          className={`px-4 py-2 text-sm font-medium ${
            mode === 'write'
              ? 'bg-white border-b-2 border-github-green-600 text-gray-900'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={`px-4 py-2 text-sm font-medium ${
            mode === 'preview'
              ? 'bg-white border-b-2 border-github-green-600 text-gray-900'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Preview
        </button>
      </div>

      {/* Content area */}
      {mode === 'write' ? (
        <textarea
          ref={resolvedRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste ?? handleImagePaste}
          onDragOver={onDragOver ?? handleImageDragOver}
          onDragLeave={onDragLeave ?? handleImageDragLeave}
          onDrop={onDrop ?? handleImageDrop}
          aria-keyshortcuts="Control+Enter"
          rows={rows}
          className={`w-full px-3 py-2 border-0 focus:outline-none focus:ring-0 font-mono text-sm resize-none md:resize-y max-h-[60vh] ${minHeightClass} ${
            dragging ? 'bg-github-green-50' : ''
          } ${uploading ? 'opacity-50' : ''}`}
          placeholder={placeholder}
          disabled={disabled || uploading}
        />
      ) : (
        <div className={`px-3 py-2 ${minHeightClass} overflow-auto bg-white`}>
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-gray-400 italic">Nothing to preview</p>
          )}
        </div>
      )}

      {/* Upload indicator */}
      {uploading && (
        <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
          Uploading image...
        </div>
      )}
    </div>
  );
}
