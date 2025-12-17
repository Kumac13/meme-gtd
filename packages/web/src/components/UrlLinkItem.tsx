/**
 * UrlLinkItem Component
 *
 * Displays an individual URL link with icon, title, URL, and delete button.
 * Opens external URLs in a new tab.
 * Includes inline delete confirmation and title editing (click title to edit).
 */

import { useState } from 'react';
import type { UrlLinkDisplayItem } from '../types/links';
import { getUrlLinkIcon, getUrlLinkLabel, truncateUrl } from '../utils/linkIcons';

interface UrlLinkItemProps {
  /** URL link data to display */
  urlLink: UrlLinkDisplayItem;
  /** Callback when delete button is clicked */
  onDelete: (urlLinkId: number) => void;
  /** Callback when title is updated */
  onUpdate?: (urlLinkId: number, title: string | null) => Promise<void>;
  /** Whether a delete operation is in progress for this link */
  isDeleting?: boolean;
}

export default function UrlLinkItem({ urlLink, onDelete, onUpdate, isDeleting = false }: UrlLinkItemProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(urlLink.title || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const displayLabel = getUrlLinkLabel(urlLink.title, urlLink.url);
  const displayUrl = truncateUrl(urlLink.url);

  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete(urlLink.id);
    setShowConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
  };

  const handleLabelClick = () => {
    if (onUpdate) {
      setEditTitle(urlLink.title || '');
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(urlLink.title || '');
  };

  const handleSaveEdit = async () => {
    if (!onUpdate) return;

    setIsUpdating(true);
    try {
      const newTitle = editTitle.trim() || null;
      await onUpdate(urlLink.id, newTitle);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update URL link:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (isEditing) {
    return (
      <div className="py-2 px-3 bg-gray-50 rounded">
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 text-gray-600">
            {getUrlLinkIcon()}
          </span>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Display title (optional)"
            disabled={isUpdating}
            autoFocus
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-github-green-500 disabled:opacity-50"
          />
          <button
            onClick={handleSaveEdit}
            disabled={isUpdating}
            className="px-2 py-1 text-xs bg-github-green-600 text-white rounded hover:bg-github-green-700 disabled:opacity-50"
          >
            {isUpdating ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancelEdit}
            disabled={isUpdating}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        <div className="mt-1 ml-6 text-xs text-gray-500 truncate" title={urlLink.url}>
          {displayUrl}
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 px-3 hover:bg-gray-50 rounded group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* External link icon */}
          <span className="flex-shrink-0 text-gray-600">
            {getUrlLinkIcon()}
          </span>

          {/* Link label - clickable to edit */}
          <span
            onClick={handleLabelClick}
            className={`text-xs flex-shrink-0 text-gray-500 ${onUpdate ? 'cursor-pointer hover:text-gray-700 hover:underline' : ''}`}
            title={onUpdate ? 'Click to edit title' : undefined}
          >
            {displayLabel}
          </span>

          {/* Arrow */}
          <span className="text-xs text-gray-400">
            &rarr;
          </span>

          {/* External URL link */}
          <a
            href={urlLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-github-green-600 hover:text-github-green-800 hover:underline truncate"
            title={urlLink.url}
          >
            {displayUrl}
          </a>
        </div>

        {/* Delete button */}
        {!showConfirm && (
          <button
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="flex-shrink-0 ml-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete URL link"
            aria-label="Delete URL link"
          >
            {isDeleting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Inline delete confirmation */}
      {showConfirm && (
        <div className="mt-2 pl-6 flex items-center gap-2 text-sm">
          <span className="text-gray-700">Delete this URL link?</span>
          <button
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Confirm'}
          </button>
          <button
            onClick={handleCancelDelete}
            disabled={isDeleting}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
