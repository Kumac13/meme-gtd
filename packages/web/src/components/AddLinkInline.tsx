import type { LinkCreationState, LinkType } from '../types/links';
import { LinkCreationEditor } from './LinkCreationEditor';

interface AddLinkInlineProps {
  sourceIssueId: number;
  onAdd: (targetId: number, linkType: LinkType) => Promise<void>;
  onAddUrlLink?: (url: string, title?: string) => Promise<void>;
  onCancel: () => void;
  creationState: LinkCreationState;
  setCreationState: (state: LinkCreationState | ((previous: LinkCreationState) => LinkCreationState)) => void;
}

/** Persisted-link adapter for the shared creation editor. */
export default function AddLinkInline({ sourceIssueId, onAdd, onAddUrlLink, onCancel, creationState, setCreationState }: AddLinkInlineProps) {
  return <div className="mt-3"><LinkCreationEditor
    selectedType={creationState.selectedType}
    onSelectedTypeChange={(selectedType) => setCreationState((previous) => ({ ...previous, selectedType, error: null }))}
    onIssueSelect={(issue, type) => onAdd(issue.id, type)}
    onUrlSubmit={onAddUrlLink}
    onCancel={onCancel}
    excludeId={sourceIssueId}
    error={creationState.error}
    submitting={creationState.isSubmitting}
  /></div>;
}
