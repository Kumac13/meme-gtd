/**
 * UrlLinkItem Component
 *
 * Displays an individual URL link with icon, title, URL, and delete button.
 * Opens external URLs in a new tab.
 * Includes inline delete confirmation and title editing via three-dot menu.
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(urlLink.title || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const displayLabel = getUrlLinkLabel(urlLink.title, urlLink.url);
  const displayUrl = truncateUrl(urlLink.url);

  const handleDeleteClick = () => {
    setIsMenuOpen(false);
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete(urlLink.id);
    setShowConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
  };

  const handleEditClick = () => {
    setIsMenuOpen(false);
    setEditTitle(urlLink.title || '');
    setIsEditing(true);
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
    <div className="py-2 px-3 hover:bg-gray-50 rounded">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* External link icon */}
          <span className="flex-shrink-0 text-gray-600">
            {getUrlLinkIcon()}
          </span>

          {/* Link label */}
          <span className="text-xs flex-shrink-0 text-gray-500">
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

        {/* Three-dot menu */}
        {!showConfirm && (
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex-shrink-0 ml-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
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
                  {onUpdate && (
                    <button
                      onClick={handleEditClick}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={handleDeleteClick}
                    disabled={isDeleting}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
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
