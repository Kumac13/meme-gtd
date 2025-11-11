import { useState } from 'react';
import { formatRelativeTime } from '../utils/dates';
import { MarkdownRenderer } from '../utils/markdown';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';

interface EditableContentProps {
  content: string;
  createdAt: string;
  updatedAt: string;
  onSave: (content: string, title?: string) => Promise<void>;
  onDelete: () => Promise<void>;
  title?: string | null;
  showTitleEdit?: boolean;
}

export default function EditableContent({
  content,
  createdAt,
  updatedAt,
  onSave,
  onDelete,
  title,
  showTitleEdit = false,
}: EditableContentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState(content);
  const [editingTitle, setEditingTitle] = useState(title || '');
  const [saving, setSaving] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    if (!editingContent.trim()) return;

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

  const handleKeyDown = useKeyboardShortcut(handleSaveEdit, {
    disabled: saving || !editingContent.trim(),
  });

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
              <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
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
                  onClick={() => {
                    handleDelete();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  Delete
                </button>
              </div>
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
          <textarea
            value={editingContent}
            onChange={(e) => setEditingContent(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-keyshortcuts="Control+Enter"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500 min-h-[100px]"
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
              disabled={saving || !editingContent.trim()}
              className="px-3 py-1 text-sm bg-github-green-600 text-white rounded-md hover:bg-github-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Save (${getShortcutHint()})`}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm max-w-none mt-1 break-words">
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
}
