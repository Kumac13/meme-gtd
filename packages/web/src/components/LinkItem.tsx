/**
 * LinkItem Component
 *
 * Displays an individual link with icon, direction, target issue title, and delete button.
 * Handles deleted target issues with appropriate styling.
 * Includes inline delete confirmation.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LinkDisplayItem } from '../types/links';
import type { IssueType } from 'meme-gtd-shared';
import { getLinkIcon, getLinkLabel, getDirectionArrow } from '../utils/linkIcons';
import { ActionMenu, InlineDeleteConfirmation } from './ActionMenu';

// Status badge colors (same as ItemList)
const statusBadgeClasses: Record<string, string> = {
  inbox: 'bg-gray-100 text-gray-700',
  open: 'bg-blue-100 text-blue-700',
  next: 'bg-green-100 text-green-700',
  waiting: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-purple-100 text-purple-700',
  someday: 'bg-orange-100 text-orange-700',
  done: 'bg-gray-200 text-gray-500',
  canceled: 'bg-red-100 text-red-500',
};

interface LinkItemProps {
  /** Link data to display */
  link: LinkDisplayItem;
  /** Callback when delete button is clicked */
  onDelete: (linkId: number) => void;
  /** Whether a delete operation is in progress for this link */
  isDeleting?: boolean;
  /** Optional callback when target link is clicked (used in page mode for modal) */
  onItemClick?: (id: number, type: IssueType) => void;
  /** Optional callback before navigation (used in panel mode to close modal first) */
  onBeforeNavigate?: () => void;
}

export default function LinkItem({ link, onDelete, isDeleting = false, onItemClick, onBeforeNavigate }: LinkItemProps) {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const isDeleted = link.targetIssue.title.includes('(deleted)');
  const targetPath = link.targetIssue.type === 'memo'
    ? `/memos/${link.targetIssue.id}`
    : link.targetIssue.type === 'article'
    ? `/articles/${link.targetIssue.id}`
    : `/tasks/${link.targetIssue.id}`;

  // Truncate title if too long
  const displayTitle = link.targetIssue.title.length > 100
    ? `${link.targetIssue.title.substring(0, 100)}...`
    : link.targetIssue.title;

  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete(link.id);
    setShowConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
  };

  return (
    <div className="py-2 px-3 hover:bg-gray-50 rounded">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Icon and direction */}
          <span className={`flex-shrink-0 ${isDeleted ? 'text-gray-400' : 'text-gray-600'}`}>
            {getLinkIcon(link.linkType, link.direction)}
          </span>

          {/* Link label and arrow */}
          <span className={`text-xs flex-shrink-0 ${isDeleted ? 'text-gray-400' : 'text-gray-500'}`}>
            {getLinkLabel(link.linkType, link.direction)} {getDirectionArrow(link.direction)}
          </span>

          {/* Target issue link */}
          {isDeleted ? (
            <span className="text-sm text-gray-400 truncate" title={link.targetIssue.title}>
              {displayTitle}
            </span>
          ) : onItemClick ? (
            <button
              onClick={() => onItemClick(link.targetIssue.id, link.targetIssue.type)}
              className="text-sm text-github-green-600 hover:text-github-green-800 hover:underline truncate text-left"
              title={link.targetIssue.title}
            >
              #{link.targetIssue.id}: {displayTitle}
            </button>
          ) : onBeforeNavigate ? (
            <button
              onClick={() => {
                onBeforeNavigate();
                navigate(targetPath);
              }}
              className="text-sm text-github-green-600 hover:text-github-green-800 hover:underline truncate text-left"
              title={link.targetIssue.title}
            >
              #{link.targetIssue.id}: {displayTitle}
            </button>
          ) : (
            <Link
              to={targetPath}
              className="text-sm text-github-green-600 hover:text-github-green-800 hover:underline truncate"
              title={link.targetIssue.title}
            >
              #{link.targetIssue.id}: {displayTitle}
            </Link>
          )}

          {/* Status badge (task only) */}
          {link.targetIssue.status && (
            <span className={`text-xs px-1.5 py-0.5 rounded capitalize flex-shrink-0 ${statusBadgeClasses[link.targetIssue.status] || 'bg-gray-100 text-gray-700'}`}>
              {link.targetIssue.status}
            </span>
          )}
        </div>

        {/* Three-dot menu */}
        {!showConfirm && (
          <ActionMenu
            buttonClassName="flex-shrink-0 ml-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            items={[{ label: 'Delete', onSelect: handleDeleteClick, destructive: true, disabled: isDeleting }]}
          />
        )}
      </div>

      {/* Inline delete confirmation */}
      {showConfirm && (
        <InlineDeleteConfirmation
          message="Delete this link?"
          deleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
}
