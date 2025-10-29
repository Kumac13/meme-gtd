/**
 * LabelsSection component
 * Feature: 020-web-label-management
 * User Story 1: Assign Existing Labels to Tasks/Memos
 */

import { useState, useEffect, useRef } from 'react';
import { LabelsService } from '../api/services/LabelsService';
import { LabelBadge } from './LabelBadge';

interface Label {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

interface LabelsSectionProps {
  itemId: number;
  itemType: 'memo' | 'task';
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
  const gearButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchLabels = async () => {
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
  };

  useEffect(() => {
    fetchLabels();
  }, []);

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

  const handleToggleLabel = async (labelId: number, isCurrentlyAssigned: boolean) => {
    try {
      setSaving(true);
      setError(null);

      if (isCurrentlyAssigned) {
        await LabelsService.removeLabelFromIssue(String(itemId), labelId);
      } else {
        await LabelsService.assignLabelToIssue(String(itemId), { labelId });
      }

      onLabelsChanged();
    } catch (err) {
      console.error('Failed to toggle label:', err);
      setError(err instanceof Error ? err.message : 'Failed to update label');
    } finally {
      setSaving(false);
    }
  };

  const filteredLabels = allLabels.filter((label) =>
    searchQuery.trim()
      ? label.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const assignedSet = new Set(assignedLabels);

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
                    return (
                      <label
                        key={label.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
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
                      </label>
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
