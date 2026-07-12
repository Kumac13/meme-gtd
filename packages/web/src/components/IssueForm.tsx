import { useState, FormEvent, useEffect, useRef, DragEvent, ClipboardEvent, ReactNode } from 'react';
import { ProjectsService } from '../api/services/ProjectsService';
import { LabelsService } from '../api/services/LabelsService';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';
import { useRecentProjects } from '../hooks/useRecentProjects';
import { useRecentLabels } from '../hooks/useRecentLabels';
import { LabelBadge } from './LabelBadge';
import TaskFormLinks from './TaskFormLinks';
import { useImageUpload } from '../hooks/useImageUpload';
import type { PendingLink } from '../types/links';
import { MarkdownTextarea } from './MarkdownTextarea';

interface Project {
  id: number;
  name: string;
  description: string | null;
  status: 'planned' | 'active' | 'paused' | 'done' | 'canceled';
  startDate: string | null;
  endDate: string | null;
  viewMeta: {
    viewType: 'board' | 'table';
    columns?: string[];
  };
  createdAt: string;
}

interface Label {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

/**
 * Values collected by the shared form. `labelNames` is derived from `labelIds`
 * so callers that persist by name (e.g. templates) don't need the label list.
 */
export interface IssueFormValues {
  title: string;
  bodyMd: string;
  labelIds: number[];
  labelNames: string[];
  projectIds: number[];
  links: PendingLink[];
}

interface IssueFormProps {
  initialTitle?: string;
  initialBodyMd?: string;
  initialLabelIds?: number[];
  initialProjectIds?: number[];
  initialLinks?: PendingLink[];
  initialProjectId?: number;
  lockedProjectId?: number;

  // Copy / labels
  titleLabel: string;
  titlePlaceholder?: string;
  bodyLabel: string;
  bodyPlaceholder?: string;
  bodyHint?: string;
  submitLabel: string;
  submittingLabel?: string;
  errorTitle: string;

  // Which optional sections to show (all default to true, create mode only)
  showProjects?: boolean;
  showLabels?: boolean;
  showLinks?: boolean;

  /** Extra fields rendered between the body and the projects/labels sections. */
  renderExtraFields?: (ctx: { submitting: boolean }) => ReactNode;
  /** Validate the collected values; return an error message or null. */
  validate?: (values: IssueFormValues) => string | null;
  /** Persist the entity (create/update + any assignments). */
  onSubmit: (values: IssueFormValues) => Promise<void>;
  onCancel: () => void;
}

const MAX_BODY = 10000;

/**
 * Shared issue-creation/edit form. Owns the concerns common to every issue
 * type — title, Markdown body (with image paste/drag upload), labels, projects,
 * links, validation and submit/cancel — so that TaskForm and TemplateForm only
 * add their type-specific fields (via renderExtraFields) and persistence (via
 * onSubmit). Extracted from the original TaskForm.
 */
export default function IssueForm({
  initialTitle = '',
  initialBodyMd = '',
  initialLabelIds = [],
  initialProjectIds,
  initialLinks = [],
  initialProjectId,
  lockedProjectId,
  titleLabel,
  titlePlaceholder,
  bodyLabel,
  bodyPlaceholder,
  bodyHint = 'Optional. Supports Markdown formatting. Max 10,000 characters.',
  submitLabel,
  submittingLabel = 'Saving...',
  errorTitle,
  showProjects = true,
  showLabels = true,
  showLinks = true,
  renderExtraFields,
  validate,
  onSubmit,
  onCancel,
}: IssueFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [bodyMd, setBodyMd] = useState(initialBodyMd);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isUploading, uploadImage } = useImageUpload();

  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>(
    initialProjectIds ?? (initialProjectId ? [initialProjectId] : [])
  );
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>(initialLabelIds);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchProjectQuery, setSearchProjectQuery] = useState('');
  const [searchLabelQuery, setSearchLabelQuery] = useState('');
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isLabelOpen, setIsLabelOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(initialLinks.length > 0);
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>(initialLinks);

  const { addRecentProject, getRecentProjects } = useRecentProjects();
  const { addRecentLabel, getRecentLabels } = useRecentLabels();

  useEffect(() => {
    if (showProjects || showLabels) {
      const fetchData = async () => {
        try {
          setLoadingData(true);
          const [projects, labels] = await Promise.all([
            ProjectsService.listProjects(),
            LabelsService.listLabels(),
          ]);
          setAllProjects(projects);
          setAllLabels(labels);
        } catch (err) {
          console.error('Failed to fetch projects/labels:', err);
        } finally {
          setLoadingData(false);
        }
      };
      fetchData();
    }
  }, [showProjects, showLabels]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const labelNames = selectedLabelIds
      .map((id) => allLabels.find((l) => l.id === id)?.name)
      .filter((n): n is string => typeof n === 'string');
    const values: IssueFormValues = {
      title,
      bodyMd,
      labelIds: selectedLabelIds,
      labelNames,
      projectIds: selectedProjectIds,
      links: pendingLinks,
    };

    const message = validate
      ? validate(values)
      : title.trim() === ''
        ? 'Title is required'
        : bodyMd.length > MAX_BODY
          ? 'Body is too long'
          : null;
    if (message) {
      setValidationError(message);
      return;
    }
    setValidationError(null);

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      console.error('Error saving issue:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = useKeyboardShortcut((e) => {
    const form = (e.target as HTMLElement).closest('form');
    if (form) form.requestSubmit();
  }, { disabled: submitting });

  const insertMarkdownRef = (markdownRef: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setBodyMd((prev) => prev + '\n' + markdownRef);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = bodyMd.slice(0, start);
    const after = bodyMd.slice(end);
    const newValue = before + (before.endsWith('\n') || before === '' ? '' : '\n') + markdownRef + '\n' + after;
    setBodyMd(newValue);
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = before.length + (before.endsWith('\n') || before === '' ? 0 : 1) + markdownRef.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleImageFile = async (file: File) => {
    if (isUploading) return;
    const result = await uploadImage(file);
    if (result.success && result.markdownRef) insertMarkdownRef(result.markdownRef);
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleImageFile(file);
        return;
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) handleImageFile(files[0]);
  };

  const handleToggleProject = (projectId: number) => {
    if (lockedProjectId && projectId === lockedProjectId && selectedProjectIds.includes(projectId)) return;
    if (selectedProjectIds.includes(projectId)) {
      setSelectedProjectIds(selectedProjectIds.filter((id) => id !== projectId));
    } else {
      setSelectedProjectIds([...selectedProjectIds, projectId]);
      addRecentProject(projectId);
    }
  };

  const handleToggleLabel = (labelId: number) => {
    if (selectedLabelIds.includes(labelId)) {
      setSelectedLabelIds(selectedLabelIds.filter((id) => id !== labelId));
    } else {
      setSelectedLabelIds([...selectedLabelIds, labelId]);
      addRecentLabel(labelId);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    try {
      const newLabel = await LabelsService.createLabel({ name: newLabelName.trim() });
      setAllLabels([...allLabels, newLabel]);
      setSelectedLabelIds([...selectedLabelIds, newLabel.id]);
      addRecentLabel(newLabel.id);
      setNewLabelName('');
      setIsCreatingLabel(false);
    } catch (err) {
      console.error('Failed to create label:', err);
      setError(err instanceof Error ? err.message : 'Failed to create label');
    }
  };

  const handleAddLink = (link: PendingLink) => setPendingLinks((prev) => [...prev, link]);
  const handleRemoveLink = (link: PendingLink) => setPendingLinks((prev) => prev.filter((l) => l !== link));

  const filteredProjects = allProjects.filter((p) =>
    searchProjectQuery.trim() ? p.name.toLowerCase().includes(searchProjectQuery.toLowerCase()) : true
  );
  const filteredLabels = allLabels.filter((l) =>
    searchLabelQuery.trim() ? l.name.toLowerCase().includes(searchLabelQuery.toLowerCase()) : true
  );
  const recentProjects = getRecentProjects(filteredProjects);
  const recentLabels = getRecentLabels(filteredLabels);

  const chevron = (open: boolean) => (
    <span className="text-gray-400 group-hover:text-gray-600">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
      </svg>
    </span>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-red-600 text-xl">⚠</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{errorTitle}</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          {titleLabel}
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-keyshortcuts="Control+Enter"
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500 ${validationError ? 'border-red-300' : 'border-gray-300'}`}
          placeholder={titlePlaceholder}
          required
        />
      </div>

      <div>
        <label htmlFor="bodyMd" className="block text-sm font-medium text-gray-700 mb-2">
          {bodyLabel}
        </label>
        <MarkdownTextarea
          textareaRef={textareaRef}
          id="bodyMd"
          value={bodyMd}
          onChange={setBodyMd}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          rows={10}
          placeholder={bodyPlaceholder}
          disabled={submitting}
          isDragging={isDragging}
          isUploading={isUploading}
          minHeightClass="min-h-[200px]"
        />
        <p className="mt-1 text-xs text-gray-500">{bodyHint}</p>
      </div>

      {renderExtraFields?.({ submitting })}

      {showProjects && (
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => {
                setIsProjectOpen(!isProjectOpen);
                if (!loadingData && allProjects.length === 0) {
                  const fetchData = async () => {
                    try {
                      setLoadingData(true);
                      const projects = await ProjectsService.listProjects();
                      setAllProjects(projects);
                    } catch (err) {
                      console.error('Failed to fetch projects:', err);
                    } finally {
                      setLoadingData(false);
                    }
                  };
                  fetchData();
                }
              }}
              className="flex items-center justify-between w-full text-left group"
            >
              <label className="block text-sm font-medium text-gray-700 cursor-pointer group-hover:text-gray-900">
                Projects
              </label>
              {chevron(isProjectOpen)}
            </button>
          </div>

          {selectedProjectIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedProjectIds.map((id) => {
                const project = allProjects.find((p) => p.id === id);
                const isLocked = lockedProjectId === id;
                return project ? (
                  <span key={id} className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${isLocked ? 'bg-github-green-100 text-github-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {project.name}
                    {isLocked ? (
                      <span className="ml-1.5 text-github-green-600" title="This project cannot be removed">✓</span>
                    ) : (
                      <button type="button" onClick={() => handleToggleProject(id)} className="ml-1.5 inline-flex items-center justify-center hover:text-gray-600">×</button>
                    )}
                  </span>
                ) : null;
              })}
            </div>
          )}

          {isProjectOpen && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col" style={{ maxHeight: '300px' }}>
              <div className="p-3 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Filter projects..."
                  value={searchProjectQuery}
                  onChange={(e) => setSearchProjectQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
                />
              </div>
              {loadingData ? (
                <div className="p-4 text-sm text-gray-500">Loading...</div>
              ) : (
                <div className="overflow-y-auto p-2">
                  {recentProjects.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Recent</h4>
                      <div className="space-y-1">
                        {recentProjects.map((project) => {
                          const isLocked = lockedProjectId === project.id;
                          return (
                            <label key={project.id} className={`flex items-center gap-2 px-2 py-1.5 rounded ${isLocked ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}>
                              <input type="checkbox" checked={selectedProjectIds.includes(project.id)} onChange={() => handleToggleProject(project.id)} disabled={isLocked} style={{ accentColor: '#16a34a', colorScheme: 'light' }} className="w-4 h-4 rounded border-gray-300" />
                              <span className="text-sm text-gray-900 truncate">{project.name}</span>
                              {isLocked && <span className="text-xs text-gray-400">(locked)</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Organization</h4>
                    <div className="space-y-1">
                      {filteredProjects.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-gray-500 text-center">
                          {searchProjectQuery.trim() ? 'No projects match your search' : 'No projects available'}
                        </div>
                      ) : (
                        filteredProjects.map((project) => {
                          const isLocked = lockedProjectId === project.id;
                          return (
                            <label key={project.id} className={`flex items-center gap-2 px-2 py-1.5 rounded ${isLocked ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}>
                              <input type="checkbox" checked={selectedProjectIds.includes(project.id)} onChange={() => handleToggleProject(project.id)} disabled={isLocked} style={{ accentColor: '#16a34a', colorScheme: 'light' }} className="w-4 h-4 rounded border-gray-300" />
                              <span className="text-sm text-gray-900 truncate">{project.name}</span>
                              {isLocked && <span className="text-xs text-gray-400">(locked)</span>}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showLabels && (
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => {
                setIsLabelOpen(!isLabelOpen);
                if (!loadingData && allLabels.length === 0) {
                  const fetchData = async () => {
                    try {
                      setLoadingData(true);
                      const labels = await LabelsService.listLabels();
                      setAllLabels(labels);
                    } catch (err) {
                      console.error('Failed to fetch labels:', err);
                    } finally {
                      setLoadingData(false);
                    }
                  };
                  fetchData();
                }
              }}
              className="flex items-center justify-between w-full text-left group"
            >
              <label className="block text-sm font-medium text-gray-700 cursor-pointer group-hover:text-gray-900">
                Labels
              </label>
              {chevron(isLabelOpen)}
            </button>
          </div>

          {selectedLabelIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedLabelIds.map((id) => {
                const label = allLabels.find((l) => l.id === id);
                return label ? (
                  <span key={id} className="inline-flex items-center gap-1">
                    <LabelBadge name={label.name} />
                    <button type="button" onClick={() => handleToggleLabel(id)} className="text-gray-400 hover:text-gray-600">×</button>
                  </span>
                ) : null;
              })}
            </div>
          )}

          {isLabelOpen && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col" style={{ maxHeight: '300px' }}>
              <div className="p-3 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Filter labels..."
                  value={searchLabelQuery}
                  onChange={(e) => setSearchLabelQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
                />
              </div>
              {loadingData ? (
                <div className="p-4 text-sm text-gray-500">Loading...</div>
              ) : (
                <div className="overflow-y-auto p-2">
                  {isCreatingLabel ? (
                    <div className="mb-3 p-3 border border-gray-300 rounded bg-white">
                      <input type="text" placeholder="Label name" value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-sm" />
                      {newLabelName.trim() && (
                        <div className="mb-2">
                          <span className="text-xs text-gray-500">Preview:</span>
                          <div className="mt-1"><LabelBadge name={newLabelName.trim()} /></div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button type="button" onClick={handleCreateLabel} disabled={!newLabelName.trim()} className="px-3 py-1 bg-github-green-600 text-white rounded text-sm hover:bg-github-green-700 disabled:opacity-50">Create</button>
                        <button type="button" onClick={() => { setIsCreatingLabel(false); setNewLabelName(''); }} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setIsCreatingLabel(true)} className="w-full mb-3 px-2 py-1.5 text-sm text-github-green-600 hover:bg-gray-50 rounded flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create new label
                    </button>
                  )}
                  {recentLabels.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Recent</h4>
                      <div className="space-y-1">
                        {recentLabels.map((label) => (
                          <label key={label.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={selectedLabelIds.includes(label.id)} onChange={() => handleToggleLabel(label.id)} style={{ accentColor: '#16a34a', colorScheme: 'light' }} className="w-4 h-4 rounded border-gray-300" />
                            <LabelBadge name={label.name} />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">All Labels</h4>
                    <div className="space-y-1">
                      {filteredLabels.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-gray-500 text-center">
                          {searchLabelQuery.trim() ? 'No labels match your search' : 'No labels available'}
                        </div>
                      ) : (
                        filteredLabels.map((label) => (
                          <label key={label.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={selectedLabelIds.includes(label.id)} onChange={() => handleToggleLabel(label.id)} style={{ accentColor: '#16a34a', colorScheme: 'light' }} className="w-4 h-4 rounded border-gray-300" />
                            <LabelBadge name={label.name} />
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showLinks && (
        <div className="border-b border-gray-200 pb-4">
          <button type="button" onClick={() => setIsLinksOpen(!isLinksOpen)} className="flex items-center justify-between w-full text-left mb-2 group">
            <label className="block text-sm font-medium text-gray-700 cursor-pointer group-hover:text-gray-900">
              Links
              {pendingLinks.length > 0 && <span className="ml-2 text-xs text-gray-500">({pendingLinks.length})</span>}
            </label>
            {chevron(isLinksOpen)}
          </button>
          {isLinksOpen && (
            <div className="mt-2">
              <TaskFormLinks links={pendingLinks} onAdd={handleAddLink} onRemove={handleRemoveLink} disabled={submitting} />
            </div>
          )}
          {!isLinksOpen && pendingLinks.length > 0 && (
            <div className="text-sm text-gray-600 mt-1">{pendingLinks.length} link(s) configured</div>
          )}
        </div>
      )}

      {validationError && <p className="text-sm text-red-600">{validationError}</p>}

      <div className="flex items-center justify-end space-x-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500" disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting} title={`Save (${getShortcutHint()})`}>
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
