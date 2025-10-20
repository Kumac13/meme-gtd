import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { TasksService } from '../api/services/TasksService';
import { formatDateTime } from '../utils/dates';
import { MarkdownRenderer } from '../utils/markdown';
import CommentSection from './CommentSection';

export interface Label {
  name: string;
  color: string;
}

export interface BaseItem {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  labels?: Label[];
  createdAt: string;
  updatedAt: string;
}

export interface Task extends BaseItem {
  status: string | null;
  scheduledOn: string | null;
}

export type Item = BaseItem | Task;

interface ItemDetailProps {
  item: Item;
  itemType: 'memo' | 'task';
  basePath: string;
  onDelete: () => Promise<void>;
  onBookmarkToggle: () => Promise<void>;
  onUpdate: (updatedItem: Item) => void;
  deleting: boolean;
  bookmarking: boolean;
}

function isTask(item: Item): item is Task {
  return 'scheduledOn' in item;
}

export default function ItemDetail({
  item,
  itemType,
  basePath,
  onDelete,
  onBookmarkToggle,
  onUpdate,
  deleting,
  bookmarking,
}: ItemDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(item.title || '');
  const [editingBody, setEditingBody] = useState(item.bodyMd);
  const [saving, setSaving] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${item.title || `${itemType === 'memo' ? 'Memo' : 'Task'} #${item.id}`}"? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    await onDelete();
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditingTitle(item.title || '');
    setEditingBody(item.bodyMd);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingTitle(item.title || '');
    setEditingBody(item.bodyMd);
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      const updatedItem =
        itemType === 'memo'
          ? await MemosService.updateMemo(String(item.id), {
              bodyMd: editingBody,
            })
          : await TasksService.updateTask(String(item.id), {
              title: editingTitle,
              bodyMd: editingBody,
            });
      onUpdate(updatedItem as Item);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={basePath}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to {itemType === 'memo' ? 'memos' : 'tasks'}
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900">
              {item.title || `${itemType === 'memo' ? 'Memo' : 'Task'} #${item.id}`}
            </h1>
            {item.labels && item.labels.length > 0 && (
              <>
                {item.labels.map((label, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 text-sm font-medium rounded"
                    style={{
                      backgroundColor: `#${label.color}`,
                      color: '#000',
                    }}
                  >
                    {label.name}
                  </span>
                ))}
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onBookmarkToggle}
              disabled={bookmarking}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title={item.isBookmarked ? 'Unbookmark' : 'Bookmark'}
            >
              {item.isBookmarked ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.91l3.023-2.489a.75.75 0 0 1 .954 0l3.023 2.49V2.75a.25.25 0 0 0-.25-.25Z"></path>
                </svg>
              )}
            </button>
            {!isEditing && (
              <button
                onClick={handleStartEdit}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="mb-6 flex items-center text-sm text-gray-500 space-x-4 border-b border-gray-200 pb-4">
        {isTask(item) && item.scheduledOn && (
          <span className="font-medium text-gray-700">
            Scheduled: {formatDateTime(item.scheduledOn).split(' ')[0]}
          </span>
        )}
        <span>Created: {formatDateTime(item.createdAt)}</span>
        {item.updatedAt !== item.createdAt && (
          <span>Updated: {formatDateTime(item.updatedAt)}</span>
        )}
      </div>

      {/* Body content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {!isEditing && (
          <div className="flex items-start justify-between mb-4">
            <div className="text-xs text-gray-500"></div>
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
                      handleDelete();
                      setIsMenuOpen(false);
                    }}
                    disabled={deleting}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {isEditing ? (
          <div>
            {itemType === 'task' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Task title"
                />
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {itemType === 'memo' ? 'Content' : 'Description'}
              </label>
              <textarea
                value={editingBody}
                onChange={(e) => setEditingBody(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px]"
                placeholder={`${itemType === 'memo' ? 'Memo' : 'Task'} content in Markdown`}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editingBody.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : item.bodyMd ? (
          <div className="prose prose-sm max-w-none">
            <MarkdownRenderer content={item.bodyMd} />
          </div>
        ) : (
          <p className="text-gray-400 italic">No {itemType === 'memo' ? 'content' : 'description'}</p>
        )}
      </div>

      {/* Comments section */}
      <CommentSection itemId={item.id} itemType={itemType} />
    </div>
  );
}
