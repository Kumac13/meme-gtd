/**
 * LinkItem Component
 *
 * Displays an individual link with icon, direction, target issue title, and delete button.
 * Handles deleted target issues with appropriate styling.
 */

import { Link } from 'react-router-dom';
import type { LinkDisplayItem } from '../types/links';
import { getLinkIcon, getLinkLabel, getDirectionArrow } from '../utils/linkIcons';

interface LinkItemProps {
  /** Link data to display */
  link: LinkDisplayItem;
  /** Callback when delete button is clicked */
  onDelete: (linkId: number) => void;
  /** Whether a delete operation is in progress for this link */
  isDeleting?: boolean;
}

export default function LinkItem({ link, onDelete, isDeleting = false }: LinkItemProps) {
  const isDeleted = link.targetIssue.title.includes('(deleted)');
  const targetPath = link.targetIssue.type === 'memo'
    ? `/memos/${link.targetIssue.id}`
    : `/tasks/${link.targetIssue.id}`;

  // Truncate title if too long
  const displayTitle = link.targetIssue.title.length > 100
    ? `${link.targetIssue.title.substring(0, 100)}...`
    : link.targetIssue.title;

  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded group">
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
        ) : (
          <Link
            to={targetPath}
            className="text-sm text-github-green-600 hover:text-github-green-800 hover:underline truncate"
            title={link.targetIssue.title}
          >
            {link.targetIssue.type === 'task' ? 'Task' : 'Memo'} #{link.targetIssue.id}: {displayTitle}
          </Link>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={() => onDelete(link.id)}
        disabled={isDeleting}
        className="flex-shrink-0 ml-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        title="Delete link"
        aria-label="Delete link"
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
    </div>
  );
}
