/**
 * AddLinkInline Component
 *
 * Multi-step inline form for creating new links.
 * Step 0: Select link category (Issue Link / URL Link)
 * Step 1a (Issue): Select link type (parent/child/relates/derived_from)
 * Step 2a (Issue): Search and select target issue using IssuePicker
 * Step 1b (URL): Enter URL and optional title
 */

import { useState } from 'react';
import type { LinkType, LinkCreationState, IssuePickerItem, LinkCategory } from '../types/links';
import IssuePicker from './IssuePicker';

interface AddLinkInlineProps {
  /** Source issue ID (the issue being viewed) */
  sourceIssueId: number;
  /** Callback when issue link is successfully created */
  onAdd: (targetId: number, linkType: LinkType) => Promise<void>;
  /** Callback when URL link is successfully created */
  onAddUrlLink?: (url: string, title?: string) => Promise<void>;
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
  onAddUrlLink,
  onCancel,
  creationState,
  setCreationState,
}: AddLinkInlineProps) {
  const { selectedType, error, isSubmitting } = creationState;
  const [category, setCategory] = useState<LinkCategory | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isUrlSubmitting, setIsUrlSubmitting] = useState(false);

  const linkTypes: Array<{ value: LinkType; label: string; description: string }> = [
    { value: 'parent', label: 'Parent', description: 'This issue is a parent of...' },
    { value: 'child', label: 'Child', description: 'This issue is a child of...' },
    { value: 'relates', label: 'Related', description: 'This issue relates to...' },
    { value: 'derived_from', label: 'Derived from', description: 'This issue is derived from...' },
  ];

  const handleCategorySelect = (cat: LinkCategory) => {
    setCategory(cat);
    setUrlError(null);
  };

  const handleTypeSelect = (type: LinkType) => {
    setCreationState({
      ...creationState,
      selectedType: type,
      error: null,
    });
  };

  const handleIssueSelect = async (issue: IssuePickerItem) => {
    if (!selectedType) {
      return;
    }

    // Call parent handler with selected issue ID
    await onAdd(issue.id, selectedType);
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) {
      setUrlError('URL is required');
      return;
    }

    // Validate URL format
    try {
      new URL(urlInput);
    } catch {
      setUrlError('Please enter a valid URL');
      return;
    }

    if (!onAddUrlLink) {
      setUrlError('URL links are not supported');
      return;
    }

    setIsUrlSubmitting(true);
    setUrlError(null);

    try {
      await onAddUrlLink(urlInput, titleInput || undefined);
      // Reset form on success
      setUrlInput('');
      setTitleInput('');
      setCategory(null);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to add URL link');
    } finally {
      setIsUrlSubmitting(false);
    }
  };

  const handleCancel = () => {
    setCategory(null);
    setUrlInput('');
    setTitleInput('');
    setUrlError(null);
    onCancel();
  };

  const handleBack = () => {
    if (category === 'issue' && selectedType) {
      // Go back to issue type selection
      setCreationState({
        ...creationState,
        selectedType: null,
        error: null,
      });
    } else {
      // Go back to category selection
      setCategory(null);
      setUrlInput('');
      setTitleInput('');
      setUrlError(null);
      setCreationState({
        ...creationState,
        selectedType: null,
        error: null,
      });
    }
  };

  return (
    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
      {/* Step 0: Category Selection */}
      {!category && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-2">Select link type:</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleCategorySelect('issue')}
              disabled={isSubmitting}
              className="px-3 py-2 text-left text-sm border border-gray-300 rounded hover:bg-white hover:border-github-green-500 focus:outline-none focus:ring-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="font-medium text-gray-900">Issue Link</div>
              <div className="text-xs text-gray-500">Link to another task or memo</div>
            </button>
            {onAddUrlLink && (
              <button
                onClick={() => handleCategorySelect('url')}
                disabled={isSubmitting}
                className="px-3 py-2 text-left text-sm border border-gray-300 rounded hover:bg-white hover:border-github-green-500 focus:outline-none focus:ring-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium text-gray-900">URL Link</div>
                <div className="text-xs text-gray-500">Link to external URL</div>
              </button>
            )}
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

      {/* Issue Link Flow: Step 1 - Type Selection */}
      {category === 'issue' && !selectedType && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-2">Select relationship type:</div>
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
          <div className="mt-2 flex justify-between">
            <button
              onClick={handleBack}
              disabled={isSubmitting}
              className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50"
            >
              Back
            </button>
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

      {/* Issue Link Flow: Step 2 - Issue Search and Selection */}
      {category === 'issue' && selectedType && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-2">
            Adding {selectedType} link:
          </div>

          {error && (
            <div className="mb-2 text-xs text-red-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM7.002 11a1 1 0 112 0 1 1 0 01-2 0zM7.1 4.995a.905.905 0 111.8 0l-.35 3.507a.552.552 0 01-1.1 0z" />
              </svg>
              {error}
            </div>
          )}

          {isSubmitting ? (
            <div className="p-4 text-center text-sm text-gray-500">
              <svg className="animate-spin h-5 w-5 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="mt-2 block">Adding link...</span>
            </div>
          ) : (
            <IssuePicker
              excludeId={sourceIssueId}
              onSelect={handleIssueSelect}
              onCancel={handleCancel}
            />
          )}
        </div>
      )}

      {/* URL Link Flow: URL Input Form */}
      {category === 'url' && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-2">Add external URL:</div>

          {urlError && (
            <div className="mb-2 text-xs text-red-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM7.002 11a1 1 0 112 0 1 1 0 01-2 0zM7.1 4.995a.905.905 0 111.8 0l-.35 3.507a.552.552 0 01-1.1 0z" />
              </svg>
              {urlError}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor="url-input" className="block text-xs text-gray-600 mb-1">
                URL <span className="text-red-500">*</span>
              </label>
              <input
                id="url-input"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                disabled={isUrlSubmitting}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500 disabled:opacity-50 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label htmlFor="title-input" className="block text-xs text-gray-600 mb-1">
                Title <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="title-input"
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="Display title"
                disabled={isUrlSubmitting}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500 disabled:opacity-50 disabled:bg-gray-100"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-between">
            <button
              onClick={handleBack}
              disabled={isUrlSubmitting}
              className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50"
            >
              Back
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={isUrlSubmitting}
                className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUrlSubmit}
                disabled={isUrlSubmitting || !urlInput.trim()}
                className="text-sm px-3 py-1.5 bg-github-green-600 text-white rounded hover:bg-github-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUrlSubmitting ? 'Adding...' : 'Add Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
