import { useState } from 'react';
import type { LinkType, PendingLink } from '../types/links';
import { isPendingIssueLink, isPendingUrlLink } from '../types/links';
import { LinkCreationEditor } from './LinkCreationEditor';

interface TaskFormLinksProps {
  links: PendingLink[];
  onAdd: (link: PendingLink) => void;
  onRemove: (link: PendingLink) => void;
  disabled?: boolean;
}

const linkTypeLabels: Record<LinkType, string> = {
  parent: 'Parent', child: 'Child', relates: 'Related', derived_from: 'Derived from',
};

/** Pending-link list adapter for the shared creation editor. */
export default function TaskFormLinks({ links, onAdd, onRemove, disabled = false }: TaskFormLinksProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedType, setSelectedType] = useState<LinkType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeEditor = () => { setSelectedType(null); setError(null); setIsAdding(false); };

  return <div>
    {links.length > 0 && <div className="space-y-2 mb-3">
      {links.map((link, index) => <div key={index} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
        <div className="flex items-center gap-2 min-w-0">
          {isPendingIssueLink(link) ? <><span className="text-xs font-medium text-gray-500 uppercase">{linkTypeLabels[link.linkType]}</span><span className="text-sm text-gray-700">{link.targetIssue ? `#${link.targetIssueId} - ${link.targetIssue.title}` : `Issue #${link.targetIssueId}`}</span></> : <><span className="text-xs font-medium text-blue-500 uppercase">URL</span><span className="text-sm text-gray-700 truncate">{link.title || link.url}</span></>}
        </div>
        <button type="button" onClick={() => onRemove(link)} disabled={disabled} className="text-gray-400 hover:text-red-500 disabled:opacity-50" title="Remove link" aria-label="Remove link">×</button>
      </div>)}
    </div>}

    {isAdding ? <LinkCreationEditor
      selectedType={selectedType}
      onSelectedTypeChange={(type) => { setSelectedType(type); setError(null); }}
      onIssueSelect={(issue, type) => {
        if (links.some((link) => isPendingIssueLink(link) && link.targetIssueId === issue.id)) return setError('Link to this issue already exists');
        onAdd({ linkKind: 'issue', targetIssueId: issue.id, linkType: type, targetIssue: { id: issue.id, type: issue.type, title: issue.title } });
        closeEditor();
      }}
      onUrlSubmit={(url, title) => {
        if (links.some((link) => isPendingUrlLink(link) && link.url === url)) throw new Error('This URL has already been added');
        onAdd({ linkKind: 'url', url, title });
        closeEditor();
      }}
      onCancel={closeEditor}
      error={error}
      disabled={disabled}
      issueNoun="This task"
    /> : <button type="button" onClick={() => setIsAdding(true)} disabled={disabled} className="w-full px-3 py-2 text-sm text-github-green-600 hover:bg-gray-50 border border-dashed border-gray-300 rounded-md disabled:opacity-50">+ Add Link</button>}
  </div>;
}
