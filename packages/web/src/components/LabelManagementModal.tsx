import { useState, useEffect, useMemo } from 'react';
import { LabelsService } from '../api/services/LabelsService';
import { MemosService } from '../api/services/MemosService';
import { TasksService } from '../api/services/TasksService';
import { LabelBadge } from './LabelBadge';

// Label type definition (matches API response)
interface Label {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

interface LabelManagementModalProps {
  itemId: number;
  itemType: 'memo' | 'task';
  isOpen: boolean;
  onClose: () => void;
  onLabelsChanged: () => void;
}

/**
 * LabelManagementModal - Modal for managing labels on memos/tasks
 *
 * Features:
 * - Assign/remove labels with checkbox interface
 * - Search/filter labels by name
 * - Optimistic UI updates with rollback on error
 * - Accessible with proper ARIA attributes
 * - Keyboard navigation support
 */
export function LabelManagementModal({
  itemId,
  itemType,
  isOpen,
  onClose,
  onLabelsChanged,
}: LabelManagementModalProps) {
  // Data state
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [assignedLabelIds, setAssignedLabelIds] = useState<Set<number>>(new Set());

  // UI state
  const [searchQuery, setSearchQuery] = useState('');

  // Async state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load labels and item data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch labels and item in parallel
        const [labels, item] = await Promise.all([
          LabelsService.listLabels(),
          itemType === 'memo'
            ? MemosService.getMemo(String(itemId))
            : TasksService.getTask(String(itemId)),
        ]);

        setAllLabels(labels);

        // Convert label names to IDs
        const labelNames = item.labels || [];
        const labelIds = new Set(
          labelNames
            .map((name) => labels.find((l) => l.name === name)?.id)
            .filter((id): id is number => id !== undefined)
        );
        setAssignedLabelIds(labelIds);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load labels');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, itemId, itemType]);

  // Filter labels by search query
  const filteredLabels = useMemo(() => {
    if (!searchQuery.trim()) return allLabels;
    const query = searchQuery.toLowerCase();
    return allLabels.filter((label) =>
      label.name.toLowerCase().includes(query)
    );
  }, [allLabels, searchQuery]);

  // Handle label toggle (assign/remove)
  const handleToggleLabel = async (labelId: number, isCurrentlyAssigned: boolean) => {
    // Optimistic update
    setAssignedLabelIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyAssigned) {
        next.delete(labelId);
      } else {
        next.add(labelId);
      }
      return next;
    });

    setSaving(true);
    setError(null);

    try {
      if (isCurrentlyAssigned) {
        // Remove label
        await LabelsService.removeLabelFromIssue(String(itemId), labelId);
      } else {
        // Assign label
        await LabelsService.assignLabelToIssue(String(itemId), { labelId });
      }

      // Notify parent to refresh item
      onLabelsChanged();
    } catch (err) {
      // Rollback on error
      setAssignedLabelIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyAssigned) {
          next.add(labelId);
        } else {
          next.delete(labelId);
        }
        return next;
      });

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update label. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    setSearchQuery('');
    setError(null);
    onClose();
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="label-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 id="label-modal-title" className="text-lg font-semibold text-gray-900">
              Manage Labels
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-github-green-500 rounded"
              aria-label="Close modal"
              type="button"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="px-6 py-3 border-b border-gray-200">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter labels..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500"
            role="searchbox"
            aria-label="Filter labels"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Loading labels...
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          ) : filteredLabels.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? 'No labels match your search.' : 'No labels available.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLabels.map((label) => {
                const isAssigned = assignedLabelIds.has(label.id);
                return (
                  <label
                    key={label.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={() => handleToggleLabel(label.id, isAssigned)}
                      disabled={saving}
                      className="w-4 h-4 text-github-green-600 border-gray-300 rounded focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      role="checkbox"
                      aria-checked={isAssigned}
                      aria-labelledby={`label-name-${label.id}`}
                    />
                    <div className="flex-1 flex items-center gap-2">
                      <LabelBadge name={label.name} />
                      {label.description && (
                        <span className="text-xs text-gray-500">
                          {label.description}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500"
            type="button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
