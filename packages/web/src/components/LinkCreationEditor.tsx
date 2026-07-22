import { useState } from 'react';
import type { IssuePickerItem, LinkType } from '../types/links';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import IssuePicker from './IssuePicker';

type ExtendedLinkType = LinkType | 'url';

interface LinkCreationEditorProps {
  selectedType: LinkType | null;
  onSelectedTypeChange: (type: LinkType | null) => void;
  onIssueSelect: (issue: IssuePickerItem, type: LinkType) => void | Promise<void>;
  onUrlSubmit?: (url: string, title?: string) => void | Promise<void>;
  onCancel: () => void;
  excludeId?: number;
  error?: string | null;
  disabled?: boolean;
  submitting?: boolean;
  issueNoun?: string;
}

const baseLinkTypes: Array<{ value: LinkType; label: string; description: string }> = [
  { value: 'parent', label: 'Parent', description: 'is a parent of...' },
  { value: 'child', label: 'Child', description: 'is a child of...' },
  { value: 'relates', label: 'Related', description: 'relates to...' },
  { value: 'derived_from', label: 'Derived from', description: 'is derived from...' },
];

/** Shared two-step issue/URL link editor used before and after issue creation. */
export function LinkCreationEditor({
  selectedType,
  onSelectedTypeChange,
  onIssueSelect,
  onUrlSubmit,
  onCancel,
  excludeId,
  error,
  disabled = false,
  submitting = false,
  issueNoun = 'This issue',
}: LinkCreationEditorProps) {
  const [urlMode, setUrlMode] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlSubmitting, setUrlSubmitting] = useState(false);
  const busy = disabled || submitting || urlSubmitting;

  const resetUrl = () => {
    setUrlMode(false);
    setUrl('');
    setTitle('');
    setUrlError(null);
  };

  const cancel = () => {
    resetUrl();
    onSelectedTypeChange(null);
    onCancel();
  };

  const submitUrl = async () => {
    if (!url.trim()) return setUrlError('URL is required');
    try { new URL(url); } catch { return setUrlError('Please enter a valid URL'); }
    if (!onUrlSubmit) return setUrlError('URL links are not supported');
    setUrlSubmitting(true);
    setUrlError(null);
    try {
      await onUrlSubmit(url, title || undefined);
      resetUrl();
    } catch (caught) {
      setUrlError(caught instanceof Error ? caught.message : 'Failed to add URL link');
    } finally {
      setUrlSubmitting(false);
    }
  };
  const handleKeyDown = useKeyboardShortcut(submitUrl, { disabled: busy || !url.trim() });

  const types: Array<{ value: ExtendedLinkType; label: string; description: string }> = [
    ...baseLinkTypes.map((item) => ({ ...item, description: `${issueNoun} ${item.description}` })),
    ...(onUrlSubmit ? [{ value: 'url' as const, label: 'External URL', description: 'Link to external website' }] : []),
  ];

  return (
    <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
      {!selectedType && !urlMode && <div>
        <div className="text-xs font-medium text-gray-700 mb-2">Select link type:</div>
        <div className="grid grid-cols-2 gap-2">
          {types.map((type) => <button key={type.value} type="button" onClick={() => type.value === 'url' ? setUrlMode(true) : onSelectedTypeChange(type.value)} disabled={busy} className="px-3 py-2 text-left text-sm border border-gray-300 rounded hover:bg-white hover:border-github-green-500 focus:outline-none focus:ring-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="font-medium text-gray-900">{type.label}</div>
            <div className="text-xs text-gray-500">{type.description}</div>
          </button>)}
        </div>
        <div className="mt-2 flex justify-end"><button type="button" onClick={cancel} disabled={busy} className="text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50">Cancel</button></div>
      </div>}

      {selectedType && !urlMode && <div>
        <div className="text-xs font-medium text-gray-700 mb-2">Adding {(baseLinkTypes.find((type) => type.value === selectedType)?.label ?? selectedType).toLowerCase()} link:</div>
        {error && <div className="mb-2 text-xs text-red-600">{error}</div>}
        {submitting ? <div className="p-4 text-center text-sm text-gray-500">Adding link...</div> : <IssuePicker excludeId={excludeId} onSelect={(issue) => onIssueSelect(issue, selectedType)} onCancel={cancel} />}
      </div>}

      {urlMode && <div>
        <div className="text-xs font-medium text-gray-700 mb-2">Add external URL:</div>
        {urlError && <div className="mb-2 text-xs text-red-600">{urlError}</div>}
        <div className="space-y-3">
          <label className="block text-xs text-gray-600">URL <span className="text-red-500">*</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={handleKeyDown} placeholder="https://..." disabled={busy} className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-github-green-500 disabled:opacity-50" /></label>
          <label className="block text-xs text-gray-600">Title <span className="text-gray-400">(optional)</span><input type="text" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={handleKeyDown} placeholder="Display title" disabled={busy} className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-github-green-500 disabled:opacity-50" /></label>
        </div>
        <div className="mt-3 flex justify-between">
          <button type="button" onClick={resetUrl} disabled={busy} className="text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50">Back</button>
          <div className="flex gap-2"><button type="button" onClick={cancel} disabled={busy} className="text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50">Cancel</button><button type="button" onClick={submitUrl} disabled={busy || !url.trim()} className="text-sm px-3 py-1.5 bg-github-green-600 text-white rounded disabled:opacity-50">{urlSubmitting ? 'Adding...' : 'Add Link'}</button></div>
        </div>
      </div>}
    </div>
  );
}
