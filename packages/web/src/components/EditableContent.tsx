import { useCallback, useState, useRef, DragEvent, ClipboardEvent } from 'react';
import type { IssueType } from 'meme-gtd-shared';
import { formatRelativeTime } from '../utils/dates';
import { MarkdownRenderer } from '../utils/markdown';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { useImageUpload } from '../hooks/useImageUpload';
import { useTodoMutation } from '../hooks/useTodoMutation';
import { MarkdownTextarea } from './MarkdownTextarea';

interface EditableContentProps {
  content: string;
  createdAt: string;
  updatedAt: string;
  onSave: (content: string, title?: string) => Promise<void>;
  onDelete: () => Promise<void>;
  title?: string | null;
  showTitleEdit?: boolean;
  enableInteractiveTodos?: boolean;
  /**
   * Click handler for internal issue links inside the rendered body
   * (used by ItemDetail to mirror LinkSection's modal-open behavior).
   */
  onIssueLinkClick?: (id: number, type: IssueType) => void;
}

export default function EditableContent({
  content,
  createdAt,
  updatedAt,
  onSave,
  onDelete,
  title,
  showTitleEdit = false,
  enableInteractiveTodos = false,
  onIssueLinkClick,
}: EditableContentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState(content);
  const [editingTitle, setEditingTitle] = useState(title || '');
  const [saving, setSaving] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  const { isUploading, uploadImage } = useImageUpload();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    await copy(content);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditingContent(content);
    setEditingTitle(title || '');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingContent(content);
    setEditingTitle(title || '');
  };

  const handleSaveEdit = async () => {
    // For tasks with title edit, allow empty body if title exists
    // For memos (no title edit), body is required
    if (!showTitleEdit && !editingContent.trim()) return;
    if (showTitleEdit && !editingTitle.trim() && !editingContent.trim()) return;

    try {
      setSaving(true);
      await onSave(editingContent, showTitleEdit ? editingTitle : undefined);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving content:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    await onDelete();
  };

  const todoSave = useCallback(
    async (next: string) => {
      await onSave(next);
    },
    [onSave],
  );

  const { content: displayContent, onToggle: handleTodoToggle, onReorder: handleTodoReorder } = useTodoMutation({
    content,
    save: todoSave,
    onError: (err) => console.error('Todo update failed:', err),
  });

  // Determine if save should be disabled
  const isSaveDisabled = saving || (
    showTitleEdit
      ? (!editingTitle.trim() && !editingContent.trim())  // Task: need title or body
      : !editingContent.trim()  // Memo: need body
  );

  const handleKeyDown = useKeyboardShortcut(() => handleSaveEdit(), {
    disabled: isSaveDisabled,
  });

  const insertMarkdownRef = (markdownRef: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setEditingContent(prev => prev + '\n' + markdownRef);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = editingContent.slice(0, start);
    const after = editingContent.slice(end);

    const newValue = before + (before.endsWith('\n') || before === '' ? '' : '\n') + markdownRef + '\n' + after;
    setEditingContent(newValue);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = before.length + (before.endsWith('\n') || before === '' ? 0 : 1) + markdownRef.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleImageFile = async (file: File) => {
    if (isUploading) return;
    const result = await uploadImage(file);
    if (result.success && result.markdownRef) {
      insertMarkdownRef(result.markdownRef);
    }
  };

  // Handle paste (Ctrl+V / Cmd+V) for images
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleImageFile(file);
        }
        return;
      }
    }
  };

  // Handle drag & drop on textarea
  const handleDragOver = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleImageFile(files[0]);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg py-1 px-4">
      <div className="flex items-center justify-between py-1 border-b border-gray-200">
        <div className="text-xs text-gray-500">
          <span title={updatedAt}>{formatRelativeTime(updatedAt)}</span>
          {updatedAt !== createdAt && <span className="ml-2 text-gray-500">(edited)</span>}
        </div>
        {!isEditing && (
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              aria-label="More options"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path>
              </svg>
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                  <button
                    onClick={() => {
                      handleStartEdit();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      await handleCopy();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => {
                      handleDelete();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {isEditing ? (
        <div>
          {showTitleEdit && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-keyshortcuts="Control+Enter"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500"
                placeholder="Task title"
              />
            </div>
          )}
          <MarkdownTextarea
            textareaRef={textareaRef}
            value={editingContent}
            onChange={setEditingContent}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            rows={6}
            disabled={false}
            isDragging={isDragging}
            isUploading={isUploading}
            minHeightClass="min-h-[100px]"
          />
          <div className="mt-2 flex justify-end space-x-2">
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={isSaveDisabled}
              className="px-3 py-1 text-sm bg-github-green-600 text-white rounded-md hover:bg-github-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Save (${getShortcutHint()})`}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm max-w-none mt-1 break-words">
          <MarkdownRenderer
            content={enableInteractiveTodos ? displayContent : content}
            interactiveTodos={
              enableInteractiveTodos
                ? {
                    enabled: true,
                    onToggle: handleTodoToggle,
                    onReorder: handleTodoReorder,
                  }
                : undefined
            }
            onIssueLinkClick={onIssueLinkClick}
          />
        </div>
      )}
    </div>
  );
}
