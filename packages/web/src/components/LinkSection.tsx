/**
 * LinkSection Component
 *
 * Main container for link management. Fetches and displays links,
 * orchestrates create/delete operations, and manages UI state.
 * Supports both issue-to-issue links and external URL links.
 */

import { useState, useEffect } from 'react';
import LinkItem from './LinkItem';
import UrlLinkItem from './UrlLinkItem';
import AddLinkInline from './AddLinkInline';
import type { LinkDisplayItem, LinkCreationState, LinkType, UrlLinkDisplayItem } from '../types/links';
import type { IssueType } from 'meme-gtd-shared';
import { LinksService } from '../api/services/LinksService';
import { UrlLinksService } from '../api/services/UrlLinksService';

// Status priority for sorting (lower = higher priority, displayed first)
const statusPriority: Record<string, number> = {
  next: 1,
  waiting: 2,
  scheduled: 3,
  open: 4,
  inbox: 5,
  someday: 6,
  done: 7,
  canceled: 8,
};

// Sort links by target issue status (active tasks first, completed last, memos at end)
const sortLinksByStatus = (links: LinkDisplayItem[]): LinkDisplayItem[] => {
  return [...links].sort((a, b) => {
    const priorityA = a.targetIssue.status ? (statusPriority[a.targetIssue.status] ?? 9) : 9;
    const priorityB = b.targetIssue.status ? (statusPriority[b.targetIssue.status] ?? 9) : 9;
    return priorityA - priorityB;
  });
};

interface ParentTaskInfo {
  id: number;
  title: string;
  status: string | null;
  labels: string[];
}

interface LinkSectionProps {
  /** ID of the issue (task, memo, or article) */
  itemId: number;
  /** Type of the issue */
  itemType: IssueType;
  /** Optional callback when a linked item is clicked (used in page mode for modal) */
  onItemClick?: (id: number, type: IssueType) => void;
  /** Optional callback before navigation (used in panel mode to close modal first) */
  onBeforeNavigate?: () => void;
  /** Parent task info for creating child tasks (only for tasks) */
  parentTask?: ParentTaskInfo;
  /** Callback when a child task is created */
  onChildTaskCreated?: () => void;
}

export default function LinkSection({ itemId, itemType: _itemType, onItemClick, onBeforeNavigate, parentTask, onChildTaskCreated: _onChildTaskCreated }: LinkSectionProps) {
  const [links, setLinks] = useState<LinkDisplayItem[]>([]);
  const [urlLinks, setUrlLinks] = useState<UrlLinkDisplayItem[]>([]);
  // Child task creation state
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [deletingLinkId, setDeletingLinkId] = useState<number | null>(null);
  const [deletingUrlLinkId, setDeletingUrlLinkId] = useState<number | null>(null);
  const [creationState, setCreationState] = useState<LinkCreationState>({
    isAdding: false,
    selectedType: null,
    targetId: '',
    error: null,
    isSubmitting: false,
  });

  // Total links count for display
  const totalLinksCount = links.length + urlLinks.length;

  // Fetch links on mount and when itemId changes
  useEffect(() => {
    fetchAllLinks();
  }, [itemId]);

  // Auto-collapse when no links, expand when links exist
  useEffect(() => {
    setIsExpanded(totalLinksCount > 0);
  }, [totalLinksCount]);

  const fetchAllLinks = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both issue links and URL links in parallel
      const [issueLinksResponse, urlLinksResponse] = await Promise.all([
        LinksService.listIssueLinks(String(itemId)),
        UrlLinksService.listUrlLinks(String(itemId)),
      ]);

      // Type assertion to add targetIssue field (which is in the actual API response but not in the generated type)
      const linksWithTarget = (issueLinksResponse || []).map((link: any) => ({
        ...link,
        targetIssue: link.targetIssue || {
          id: link.targetIssueId,
          type: 'task' as const,
          title: `Issue #${link.targetIssueId}`,
        },
      }));
      // Sort links by status (active tasks first, completed last)
      setLinks(sortLinksByStatus(linksWithTarget));
      setUrlLinks(urlLinksResponse || []);
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
      await fetchAllLinks();
    } catch (err) {
      console.error('Failed to delete link:', err);
      alert('Failed to delete link. Please try again.');
    } finally {
      setDeletingLinkId(null);
    }
  };

  const handleDeleteUrlLink = async (urlLinkId: number) => {
    setDeletingUrlLinkId(urlLinkId);
    try {
      await UrlLinksService.deleteUrlLink(String(urlLinkId));
      // Refresh links after deletion
      await fetchAllLinks();
    } catch (err) {
      console.error('Failed to delete URL link:', err);
      alert('Failed to delete URL link. Please try again.');
    } finally {
      setDeletingUrlLinkId(null);
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
      await fetchAllLinks();
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

  const handleAddUrlLink = async (url: string, title?: string) => {
    try {
      await UrlLinksService.createUrlLink(String(itemId), { url, title });
      // Refresh links after creation
      await fetchAllLinks();
      // Close form and reset state
      setCreationState({
        isAdding: false,
        selectedType: null,
        targetId: '',
        error: null,
        isSubmitting: false,
      });
    } catch (err: any) {
      console.error('Failed to create URL link:', err);
      throw new Error(err?.body?.message || err?.message || 'Failed to create URL link');
    }
  };

  const handleUpdateUrlLink = async (urlLinkId: number, title: string | null) => {
    try {
      await UrlLinksService.updateUrlLink(String(urlLinkId), { title });
      // Refresh links after update
      await fetchAllLinks();
    } catch (err) {
      console.error('Failed to update URL link:', err);
      throw err;
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
            Links {loading ? <span className="text-gray-400">(loading...)</span> : `(${totalLinksCount})`}
          </h3>
        </div>

        {/* Add buttons */}
        <div className="flex gap-1">
          <button
            className="text-xs px-2 py-1 text-github-green-600 hover:text-github-green-800 hover:bg-github-green-50 rounded border border-github-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={(e) => {
              e.stopPropagation();
              handleAddClick();
            }}
            disabled={loading || creationState.isAdding || isAddingChild}
          >
            + Add
          </button>
          {parentTask && (
            <button
              className="text-xs px-2 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e) => {
                e.stopPropagation();
                setIsAddingChild(true);
                setIsExpanded(true);
              }}
              disabled={loading || creationState.isAdding || isAddingChild}
            >
              Add Child
            </button>
          )}
        </div>
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
                onClick={fetchAllLinks}
                className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 rounded text-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && totalLinksCount === 0 && !creationState.isAdding && (
            <div className="text-sm text-gray-500 py-2">
              No links yet
            </div>
          )}

          {/* Add link form */}
          {creationState.isAdding && (
            <AddLinkInline
              sourceIssueId={itemId}
              onAdd={handleAddLink}
              onAddUrlLink={handleAddUrlLink}
              onCancel={handleCancelAdd}
              creationState={creationState}
              setCreationState={setCreationState}
            />
          )}

          {!loading && !error && totalLinksCount > 0 && (
            <div className="space-y-1">
              {/* Issue Links */}
              {links.map((link) => (
                <LinkItem
                  key={`issue-${link.id}`}
                  link={link}
                  onDelete={handleDelete}
                  isDeleting={deletingLinkId === link.id}
                  onItemClick={onItemClick}
                  onBeforeNavigate={onBeforeNavigate}
                />
              ))}
              {/* URL Links */}
              {urlLinks.map((urlLink) => (
                <UrlLinkItem
                  key={`url-${urlLink.id}`}
                  urlLink={urlLink}
                  onDelete={handleDeleteUrlLink}
                  onUpdate={handleUpdateUrlLink}
                  isDeleting={deletingUrlLinkId === urlLink.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
