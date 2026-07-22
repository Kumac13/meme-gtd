import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IssueType } from 'meme-gtd-shared';
import { LabelsService } from '../api/services/LabelsService';
import { useRecentLabels } from '../hooks/useRecentLabels';
import { LabelBadge } from './LabelBadge';
import { ManagementSection } from './ManagementSection';

interface Label {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

interface LabelsSectionProps {
  itemId: number;
  itemType: IssueType | 'template';
  assignedLabels: string[];
  onLabelsChanged: () => void;
}

export function LabelsSection({
  itemId,
  itemType: _itemType,
  assignedLabels,
  onLabelsChanged,
}: LabelsSectionProps) {
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const { addRecentLabel, getRecentLabels } = useRecentLabels();

  const fetchLabels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAllLabels(await LabelsService.listLabels());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to fetch labels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLabels();
  }, [fetchLabels]);

  const toggleLabel = async (labelId: number, assigned: boolean) => {
    try {
      setSaving(true);
      setError(null);
      if (assigned) await LabelsService.removeLabelFromIssue(String(itemId), labelId);
      else {
        await LabelsService.assignLabelToIssue(String(itemId), { labelId });
        addRecentLabel(labelId);
      }
      onLabelsChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to update label');
    } finally {
      setSaving(false);
    }
  };

  const createLabel = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      setSaving(true);
      setError(null);
      const label = await LabelsService.createLabel({ name, description: newDescription.trim() || undefined });
      await LabelsService.assignLabelToIssue(String(itemId), { labelId: label.id });
      addRecentLabel(label.id);
      await fetchLabels();
      onLabelsChanged();
      setNewName('');
      setNewDescription('');
      setIsCreating(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create label');
    } finally {
      setSaving(false);
    }
  };

  const deleteLabel = async (name: string) => {
    if (!window.confirm(`Are you sure you want to delete label "${name}"? This will remove it from all items and cannot be undone.`)) return;
    try {
      setSaving(true);
      setDeletingName(name);
      setError(null);
      await LabelsService.deleteLabel(name);
      await fetchLabels();
      onLabelsChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete label');
    } finally {
      setSaving(false);
      setDeletingName(null);
    }
  };

  const filteredLabels = useMemo(() => allLabels.filter((label) =>
    !searchQuery.trim() || label.name.toLowerCase().includes(searchQuery.toLowerCase())
  ), [allLabels, searchQuery]);
  const recentLabels = useMemo(() => getRecentLabels(filteredLabels), [filteredLabels, getRecentLabels]);
  const assigned = useMemo(() => new Set(assignedLabels), [assignedLabels]);

  const labelOption = (label: Label) => (
    <div key={label.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 group">
      <input
        type="checkbox"
        checked={assigned.has(label.name)}
        onChange={() => void toggleLabel(label.id, assigned.has(label.name))}
        disabled={saving}
        style={{ accentColor: '#16a34a', colorScheme: 'light' }}
        className="w-4 h-4 rounded border-gray-300"
      />
      <span className="flex-1 min-w-0"><LabelBadge name={label.name} /></span>
      <button
        type="button"
        onClick={() => void deleteLabel(label.name)}
        disabled={saving}
        className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-opacity disabled:opacity-50"
        title="Delete label"
      >
        {deletingName === label.name ? '…' : '×'}
      </button>
    </div>
  );

  return (
    <ManagementSection
      title="Labels"
      ariaLabel="Manage labels"
      loading={loading}
      loadingMessage="Loading labels..."
      error={error}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchPlaceholder="Filter labels"
      summary={assignedLabels.length === 0
        ? <div className="text-gray-500 text-sm">No labels yet</div>
        : <div className="flex flex-wrap gap-2">{assignedLabels.map((name) => <LabelBadge key={name} name={name} />)}</div>}
    >
      {isCreating ? (
        <div className="mb-4 p-3 border border-gray-200 rounded bg-gray-50">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Create New Label</h4>
          <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Label name (required)" disabled={saving} className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-sm" />
          <input value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Description (optional)" disabled={saving} className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-sm" />
          {newName.trim() && <div className="mb-2"><LabelBadge name={newName.trim()} /></div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void createLabel()} disabled={saving || !newName.trim()} className="flex-1 px-3 py-1 bg-github-green-600 text-white rounded text-sm disabled:opacity-50">Create</button>
            <button type="button" onClick={() => setIsCreating(false)} disabled={saving} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setIsCreating(true)} className="w-full mb-3 px-2 py-1.5 text-sm text-github-green-600 hover:bg-gray-50 rounded text-left">＋ Create new label</button>
      )}

      {recentLabels.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Recent</h4>
          <div className="space-y-1">{recentLabels.map(labelOption)}</div>
        </div>
      )}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">All Labels</h4>
        <div className="space-y-1">
          {filteredLabels.length > 0
            ? filteredLabels.map(labelOption)
            : <div className="px-2 py-4 text-sm text-gray-500 text-center">{searchQuery.trim() ? 'No labels match your search' : 'No labels available'}</div>}
        </div>
      </div>
    </ManagementSection>
  );
}
