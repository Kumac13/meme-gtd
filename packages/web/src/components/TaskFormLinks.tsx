/**
 * TaskFormLinks Component
 *
 * Links management section for TaskForm.
 * Displays existing pending links and allows adding/removing links
 * before task creation.
 */

import { useState } from 'react';
import type { LinkType, PendingLink, IssuePickerItem } from '../types/links';
import IssuePicker from './IssuePicker';

interface TaskFormLinksProps {
  /** List of pending links */
  links: PendingLink[];
  /** Callback when a link is added */
  onAdd: (link: PendingLink) => void;
  /** Callback when a link is removed */
  onRemove: (targetIssueId: number) => void;
  /** Whether the form is disabled */
  disabled?: boolean;
}

const linkTypes: Array<{ value: LinkType; label: string; description: string }> = [
  { value: 'parent', label: 'Parent', description: 'This task is a parent of...' },
  { value: 'child', label: 'Child', description: 'This task is a child of...' },
  { value: 'relates', label: 'Related', description: 'This task relates to...' },
  { value: 'derived_from', label: 'Derived from', description: 'This task is derived from...' },
];

const linkTypeLabels: Record<LinkType, string> = {
  parent: 'Parent',
  child: 'Child',
  relates: 'Related',
  derived_from: 'Derived from',
};

export default function TaskFormLinks({
  links,
  onAdd,
  onRemove,
  disabled = false,
}: TaskFormLinksProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedType, setSelectedType] = useState<LinkType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTypeSelect = (type: LinkType) => {
    setSelectedType(type);
    setError(null);
  };

  const handleIssueSelect = (issue: IssuePickerItem) => {
    if (!selectedType) {
      return;
    }

    // Check for duplicate
    if (links.some(l => l.targetIssueId === issue.id)) {
      setError('Link to this issue already exists');
      return;
    }

    onAdd({
      targetIssueId: issue.id,
      linkType: selectedType,
      targetIssue: {
        id: issue.id,
        type: issue.type,
        title: issue.title,
      },
    });

    // Reset form
    setSelectedType(null);
    setIsAdding(false);
    setError(null);
  };

  const handleCancel = () => {
    setSelectedType(null);
    setIsAdding(false);
    setError(null);
  };

  return (
    <div>
      {/* Existing Links List */}
      {links.length > 0 && (
        <div className="space-y-2 mb-3">
          {links.map((link) => (
            <div
              key={link.targetIssueId}
              className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-md"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 uppercase">
                  {linkTypeLabels[link.linkType]}
                </span>
                <span className="text-sm text-gray-700">
                  {link.targetIssue ? (
                    <>
                      #{link.targetIssueId} - {link.targetIssue.title}
                    </>
                  ) : (
                    <>Issue #{link.targetIssueId}</>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(link.targetIssueId)}
                disabled={disabled}
                className="text-gray-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remove link"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Link Form */}
      {isAdding ? (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
          {/* Step 1: Type Selection */}
          {!selectedType && (
            <div>
              <div className="text-xs font-medium text-gray-700 mb-2">Select link type:</div>
              <div className="grid grid-cols-2 gap-2">
                {linkTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleTypeSelect(type.value)}
                    disabled={disabled}
                    className="px-3 py-2 text-left text-sm border border-gray-300 rounded hover:bg-white hover:border-github-green-500 focus:outline-none focus:ring-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-gray-900">{type.label}</div>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={disabled}
                  className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Issue Search and Selection */}
          {selectedType && (
            <div>
              <div className="text-xs font-medium text-gray-700 mb-2">
                Adding {linkTypeLabels[selectedType].toLowerCase()} link:
              </div>

              {error && (
                <div className="mb-2 text-xs text-red-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM7.002 11a1 1 0 112 0 1 1 0 01-2 0zM7.1 4.995a.905.905 0 111.8 0l-.35 3.507a.552.552 0 01-1.1 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <IssuePicker
                onSelect={handleIssueSelect}
                onCancel={handleCancel}
              />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm text-github-green-600 hover:bg-gray-50 border border-dashed border-gray-300 rounded-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Link
        </button>
      )}
    </div>
  );
}
