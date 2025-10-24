/**
 * AddLinkInline Component
 *
 * Multi-step inline form for creating new links.
 * Step 1: Select link type (parent/child/relates/derived_from)
 * Step 2: Enter target issue ID and submit
 */

import { useState } from 'react';
import type { LinkType, LinkCreationState } from '../types/links';

interface AddLinkInlineProps {
  /** Source issue ID (the issue being viewed) */
  sourceIssueId: number;
  /** Callback when link is successfully created */
  onAdd: (targetId: number, linkType: LinkType) => Promise<void>;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Creation state from parent component */
  creationState: LinkCreationState;
  /** Setter for creation state */
  setCreationState: (state: LinkCreationState | ((prev: LinkCreationState) => LinkCreationState)) => void;
}

export default function AddLinkInline({
  sourceIssueId,
  onAdd,
  onCancel,
  creationState,
  setCreationState,
}: AddLinkInlineProps) {
  const { selectedType, targetId, error, isSubmitting } = creationState;

  const linkTypes: Array<{ value: LinkType; label: string; description: string }> = [
    { value: 'parent', label: 'Parent', description: 'This issue is a parent of...' },
    { value: 'child', label: 'Child', description: 'This issue is a child of...' },
    { value: 'relates', label: 'Related', description: 'This issue relates to...' },
    { value: 'derived_from', label: 'Derived from', description: 'This issue is derived from...' },
  ];

  const handleTypeSelect = (type: LinkType) => {
    setCreationState({
      ...creationState,
      selectedType: type,
      error: null,
    });
  };

  const handleTargetIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCreationState({
      ...creationState,
      targetId: e.target.value,
      error: null,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    const targetIdNum = parseInt(targetId, 10);
    if (!targetId || isNaN(targetIdNum) || targetIdNum <= 0) {
      setCreationState({
        ...creationState,
        error: 'Please enter a valid issue ID',
      });
      return;
    }

    if (targetIdNum === sourceIssueId) {
      setCreationState({
        ...creationState,
        error: 'Cannot link issue to itself',
      });
      return;
    }

    if (!selectedType) {
      setCreationState({
        ...creationState,
        error: 'Please select a link type',
      });
      return;
    }

    // Call parent handler
    await onAdd(targetIdNum, selectedType);
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
      {/* Step 1: Type Selection */}
      {!selectedType && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-2">Select link type:</div>
          <div className="grid grid-cols-2 gap-2">
            {linkTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => handleTypeSelect(type.value)}
                disabled={isSubmitting}
                className="px-3 py-2 text-left text-sm border border-gray-300 rounded hover:bg-white hover:border-github-green-500 focus:outline-none focus:ring-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium text-gray-900">{type.label}</div>
                <div className="text-xs text-gray-500">{type.description}</div>
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 2: ID Input */}
      {selectedType && (
        <form onSubmit={handleSubmit}>
          <div className="text-xs font-medium text-gray-700 mb-2">
            Adding {selectedType} link:
          </div>

          <div className="flex items-start gap-2">
            <div className="flex-1">
              <input
                type="number"
                value={targetId}
                onChange={handleTargetIdChange}
                placeholder="Enter issue ID (e.g., 5)"
                disabled={isSubmitting}
                autoFocus
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500 disabled:opacity-50 disabled:bg-gray-100"
              />

              {error && (
                <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM7.002 11a1 1 0 112 0 1 1 0 01-2 0zM7.1 4.995a.905.905 0 111.8 0l-.35 3.507a.552.552 0 01-1.1 0z" />
                  </svg>
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !targetId}
              className="px-3 py-1.5 text-sm bg-github-green-600 text-white rounded hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Adding...
                </span>
              ) : (
                'Add'
              )}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
