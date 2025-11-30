/**
 * LinkSection Component
 *
 * Main container for link management. Fetches and displays links,
 * orchestrates create/delete operations, and manages UI state.
 */

import { useState, useEffect } from 'react';
import LinkItem from './LinkItem';
import AddLinkInline from './AddLinkInline';
import type { LinkDisplayItem, LinkCreationState, LinkType } from '../types/links';
import { LinksService } from '../api/services/LinksService';

interface LinkSectionProps {
  /** ID of the issue (task or memo) */
  itemId: number;
  /** Type of the issue */
  itemType: 'memo' | 'task';
  /** Optional callback when a linked item is clicked (used in page mode for modal) */
  onItemClick?: (id: number, type: 'memo' | 'task') => void;
}

export default function LinkSection({ itemId, itemType: _itemType, onItemClick }: LinkSectionProps) {
  const [links, setLinks] = useState<LinkDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [deletingLinkId, setDeletingLinkId] = useState<number | null>(null);
  const [creationState, setCreationState] = useState<LinkCreationState>({
    isAdding: false,
    selectedType: null,
    targetId: '',
    error: null,
    isSubmitting: false,
  });

  // Fetch links on mount and when itemId changes
  useEffect(() => {
    fetchLinks();
  }, [itemId]);

  // Auto-collapse when no links, expand when links exist
  useEffect(() => {
    setIsExpanded(links.length > 0);
  }, [links.length]);

  const fetchLinks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await LinksService.listIssueLinks(String(itemId));
      // Type assertion to add targetIssue field (which is in the actual API response but not in the generated type)
      const linksWithTarget = response.map((link: any) => ({
        ...link,
        targetIssue: link.targetIssue || {
          id: link.targetIssueId,
          type: 'task' as const,
          title: `Issue #${link.targetIssueId}`,
        },
      }));
      setLinks(linksWithTarget);
    } catch (err) {
      console.error('Failed to fetch links:', err);
      setError('Failed to load links');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (linkId: number) => {
    setDeletingLinkId(linkId);
    try {
      await LinksService.deleteLink(String(linkId));
      // Refresh links after deletion
      await fetchLinks();
    } catch (err) {
      console.error('Failed to delete link:', err);
      alert('Failed to delete link. Please try again.');
    } finally {
      setDeletingLinkId(null);
    }
  };

  const handleAddClick = () => {
    setIsExpanded(true); // Always expand when adding
    setCreationState({
      isAdding: true,
      selectedType: null,
      targetId: '',
      error: null,
      isSubmitting: false,
    });
  };

  const handleCancelAdd = () => {
    setCreationState({
      isAdding: false,
      selectedType: null,
      targetId: '',
      error: null,
      isSubmitting: false,
    });
  };

  const handleAddLink = async (targetId: number, linkType: LinkType) => {
    setCreationState((prev) => ({ ...prev, isSubmitting: true, error: null }));
    try {
      await LinksService.createLink({
        sourceIssueId: itemId,
        targetIssueId: targetId,
        linkType,
      });
      // Refresh links after creation
      await fetchLinks();
      // Close form and reset state
      setCreationState({
        isAdding: false,
        selectedType: null,
        targetId: '',
        error: null,
        isSubmitting: false,
      });
    } catch (err: any) {
      console.error('Failed to create link:', err);
      // Parse error message from API
      let errorMessage = 'Failed to create link';
      if (err?.body?.message) {
        errorMessage = err.body.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      setCreationState((prev) => ({ ...prev, isSubmitting: false, error: errorMessage }));
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="border-b border-gray-200 py-4">
      {/* Section Header */}
      <button
        onClick={toggleExpanded}
        className="flex items-center justify-between w-full text-left hover:bg-gray-50 rounded px-2 py-1 -ml-2"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {/* Chevron icon */}
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
          </svg>

          {/* Section title with count */}
          <h3 className="text-sm font-semibold text-gray-900">
            Links {loading ? <span className="text-gray-400">(loading...)</span> : `(${links.length})`}
          </h3>
        </div>

        {/* Add button */}
        <button
          className="text-xs px-2 py-1 text-github-green-600 hover:text-github-green-800 hover:bg-github-green-50 rounded border border-github-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={(e) => {
            e.stopPropagation();
            handleAddClick();
          }}
          disabled={loading || creationState.isAdding}
        >
          + Add
        </button>
      </button>

      {/* Section Content */}
      {isExpanded && (
        <div className="mt-2 ml-2">
          {loading && (
            <div className="text-sm text-gray-500 py-2">
              Loading links...
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 py-2 flex items-center gap-2">
              <span>⚠️ {error}</span>
              <button
                onClick={fetchLinks}
                className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 rounded text-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && links.length === 0 && !creationState.isAdding && (
            <div className="text-sm text-gray-500 py-2">
              No links yet
            </div>
          )}

          {/* Add link form */}
          {creationState.isAdding && (
            <AddLinkInline
              sourceIssueId={itemId}
              onAdd={handleAddLink}
              onCancel={handleCancelAdd}
              creationState={creationState}
              setCreationState={setCreationState}
            />
          )}

          {!loading && !error && links.length > 0 && (
            <div className="space-y-1">
              {links.map((link) => (
                <LinkItem
                  key={link.id}
                  link={link}
                  onDelete={handleDelete}
                  isDeleting={deletingLinkId === link.id}
                  onItemClick={onItemClick}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
