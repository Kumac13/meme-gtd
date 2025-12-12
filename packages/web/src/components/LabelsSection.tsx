/**
 * LabelsSection component
 * Feature: 020-web-label-management
 * User Story 1: Assign Existing Labels to Tasks/Memos
 *
 * Provides label management UI in item detail sidebar:
 * - Display assigned labels
 * - Inline dropdown for label selection/creation/deletion
 * - Recent labels section for quick access
 * - Full keyboard navigation and accessibility support
 * - Search/filter labels by name
 *
 * @example
 * ```tsx
 * <LabelsSection
 *   itemId={task.id}
 *   itemType="task"
 *   assignedLabels={task.labels}
 *   onLabelsChanged={() => refetchTask()}
 * />
 * ```
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LabelsService } from '../api/services/LabelsService';
import { LabelBadge } from './LabelBadge';
import { useRecentLabels } from '../hooks/useRecentLabels';

/**
 * Label entity from API
 */
interface Label {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

/**
 * Props for LabelsSection component
 * @property itemId - The ID of the item (task/memo) to manage labels for
 * @property itemType - Type of item ('memo' or 'task')
 * @property assignedLabels - Array of label names currently assigned to the item
 * @property onLabelsChanged - Callback when labels are modified (assign/remove/create/delete)
 */
interface LabelsSectionProps {
  itemId: number;
  itemType: 'memo' | 'task' | 'article';
  assignedLabels: string[];
  onLabelsChanged: () => void;
}

export function LabelsSection({ itemId, itemType: _, assignedLabels, onLabelsChanged }: LabelsSectionProps) {
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelDescription, setNewLabelDescription] = useState('');
  const [deletingLabelName, setDeletingLabelName] = useState<string | null>(null);
  const gearButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { addRecentLabel, getRecentLabels } = useRecentLabels();

  const fetchLabels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const labels = await LabelsService.listLabels();
      setAllLabels(labels);
    } catch (err) {
      console.error('Failed to fetch labels:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch labels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        gearButtonRef.current &&
        !gearButtonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const handleToggleLabel = useCallback(async (labelId: number, isCurrentlyAssigned: boolean) => {
    try {
      setSaving(true);
      setError(null);

      if (isCurrentlyAssigned) {
        await LabelsService.removeLabelFromIssue(String(itemId), labelId);
      } else {
        await LabelsService.assignLabelToIssue(String(itemId), { labelId });
        // Track as recent label (only on assign, not remove)
        addRecentLabel(labelId);
      }

      onLabelsChanged();
    } catch (err) {
      console.error('Failed to toggle label:', err);
      setError(err instanceof Error ? err.message : 'Failed to update label');
    } finally {
      setSaving(false);
    }
  }, [itemId, addRecentLabel, onLabelsChanged]);

  const handleCreateLabel = useCallback(async () => {
    if (!newLabelName.trim()) {
      setError('Label name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const newLabel = await LabelsService.createLabel({
        name: newLabelName.trim(),
        description: newLabelDescription.trim() || undefined,
      });

      // Refresh labels list
      await fetchLabels();

      // Automatically assign the new label to the current item
      await LabelsService.assignLabelToIssue(String(itemId), { labelId: newLabel.id });
      // Track as recent label
      addRecentLabel(newLabel.id);
      onLabelsChanged();

      // Reset form
      setNewLabelName('');
      setNewLabelDescription('');
      setIsCreatingLabel(false);
    } catch (err) {
      console.error('Failed to create label:', err);
      setError(err instanceof Error ? err.message : 'Failed to create label');
    } finally {
      setSaving(false);
    }
  }, [newLabelName, newLabelDescription, itemId, addRecentLabel, onLabelsChanged, fetchLabels]);

  const handleDeleteLabel = useCallback(async (labelName: string) => {
    if (!window.confirm(`Are you sure you want to delete label "${labelName}"? This will remove it from all items and cannot be undone.`)) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setDeletingLabelName(labelName);

      await LabelsService.deleteLabel(labelName);

      // Refresh labels list
      await fetchLabels();

      // Refresh item to update assigned labels
      onLabelsChanged();
    } catch (err) {
      console.error('Failed to delete label:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete label');
    } finally {
      setSaving(false);
      setDeletingLabelName(null);
    }
  }, [onLabelsChanged, fetchLabels]);

  const filteredLabels = useMemo(() =>
    allLabels.filter((label) =>
      searchQuery.trim()
        ? label.name.toLowerCase().includes(searchQuery.toLowerCase())
        : true
    ),
    [allLabels, searchQuery]
  );

  const recentLabels = useMemo(() =>
    getRecentLabels(filteredLabels),
    [getRecentLabels, filteredLabels]
  );

  const assignedSet = useMemo(() =>
    new Set(assignedLabels),
    [assignedLabels]
  );

  // Show loading state
  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <div className="text-gray-500 text-sm">Loading labels...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="text-red-600 text-sm">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        {/* Header with gear icon */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Labels</h3>
          <button
            ref={gearButtonRef}
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
            aria-label="Label settings"
            title="Manage labels"
          >
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        {/* Labels list */}
        <div className="space-y-2">
          {assignedLabels.length === 0 ? (
            <div className="text-gray-500 text-sm">
              No labels yet
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assignedLabels.map((labelName) => (
                <LabelBadge key={labelName} name={labelName} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col"
          style={{ maxHeight: '400px' }}
        >
          {/* Search */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Filter labels"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
            />
          </div>

          {/* Labels list */}
          <div className="overflow-y-auto p-2" style={{ maxHeight: '320px' }}>
            {error && (
              <div className="p-2 mb-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Create new label section */}
            {isCreatingLabel ? (
              <div className="mb-4 p-3 border border-gray-200 rounded bg-gray-50">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Create New Label</h4>
                <input
                  type="text"
                  placeholder="Label name (required)"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
                  disabled={saving}
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newLabelDescription}
                  onChange={(e) => setNewLabelDescription(e.target.value)}
                  className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
                  disabled={saving}
                />
                {newLabelName.trim() && (
                  <div className="mb-2">
                    <span className="text-xs text-gray-500">Preview:</span>
                    <div className="mt-1">
                      <LabelBadge name={newLabelName.trim()} />
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateLabel}
                    disabled={saving || !newLabelName.trim()}
                    className="flex-1 px-3 py-1 bg-github-green-600 text-white rounded text-sm hover:bg-github-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    onClick={() => {
                      setIsCreatingLabel(false);
                      setNewLabelName('');
                      setNewLabelDescription('');
                      setError(null);
                    }}
                    disabled={saving}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCreatingLabel(true)}
                className="w-full mb-3 px-2 py-1.5 text-sm text-github-green-600 hover:bg-gray-50 rounded flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create new label
              </button>
            )}

            {/* Recent labels section */}
            {recentLabels.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">
                  Recent
                </h4>
                <div className="space-y-1">
                  {recentLabels.map((label) => {
                    const isAssigned = assignedSet.has(label.name);
                    const isDeleting = deletingLabelName === label.name;
                    return (
                      <div
                        key={label.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 group"
                      >
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => handleToggleLabel(label.id, isAssigned)}
                          disabled={saving}
                          style={{
                            accentColor: '#16a34a',
                            colorScheme: 'light',
                          }}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="flex-1 min-w-0">
                          <LabelBadge name={label.name} />
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLabel(label.name);
                          }}
                          disabled={saving}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-opacity disabled:opacity-50"
                          title="Delete label"
                        >
                          {isDeleting ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All labels section */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">
                All Labels
              </h4>
              <div className="space-y-1">
                {filteredLabels.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-gray-500 text-center">
                    {searchQuery.trim() ? 'No labels match your search' : 'No labels available'}
                  </div>
                ) : (
                  filteredLabels.map((label) => {
                    const isAssigned = assignedSet.has(label.name);
                    const isDeleting = deletingLabelName === label.name;
                    return (
                      <div
                        key={label.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 group"
                      >
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => handleToggleLabel(label.id, isAssigned)}
                          disabled={saving}
                          style={{
                            accentColor: '#16a34a',
                            colorScheme: 'light',
                          }}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="flex-1 min-w-0">
                          <LabelBadge name={label.name} />
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLabel(label.name);
                          }}
                          disabled={saving}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-opacity disabled:opacity-50"
                          title="Delete label"
                        >
                          {isDeleting ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
