import { useState } from 'react';
import { formatRelativeTime } from '../utils/dates';
import { MarkdownRenderer } from '../utils/markdown';

interface EditableContentProps {
  content: string;
  createdAt: string;
  updatedAt: string;
  onSave: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export default function EditableContent({
  content,
  createdAt,
  updatedAt,
  onSave,
  onDelete,
}: EditableContentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState(content);
  const [saving, setSaving] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditingContent(content);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingContent(content);
  };

  const handleSaveEdit = async () => {
    if (!editingContent.trim()) return;

    try {
      setSaving(true);
      await onSave(editingContent);
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

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
        <div className="text-xs text-gray-500">
          <span title={updatedAt}>{formatRelativeTime(updatedAt)}</span>
          {updatedAt !== createdAt && <span className="ml-2">(edited)</span>}
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
          <textarea
            value={editingContent}
            onChange={(e) => setEditingContent(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
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
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm max-w-none">
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
}
