import { useState, FormEvent, useEffect, useRef, DragEvent, ClipboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TaskKind } from 'meme-gtd-shared';
import { TasksService } from '../api/services/TasksService';
import { ProjectsService } from '../api/services/ProjectsService';
import { LabelsService } from '../api/services/LabelsService';
import { LinksService } from '../api/services/LinksService';
import { UrlLinksService } from '../api/services/UrlLinksService';
import { isPendingIssueLink, isPendingUrlLink } from '../types/links';
import { validateTaskForm } from '../utils/validation';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';
import { ScheduleInput, type ScheduleInputValue } from './ScheduleInput';
import { useRecentProjects } from '../hooks/useRecentProjects';
import { useRecentLabels } from '../hooks/useRecentLabels';
import { LabelBadge } from './LabelBadge';
import TaskFormLinks from './TaskFormLinks';
import { useImageUpload } from '../hooks/useImageUpload';
import type { PendingLink } from '../types/links';
import { MarkdownTextarea } from './MarkdownTextarea';

type TaskStatus = 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';

interface TaskFormProps {
  initialTitle?: string;
  initialBodyMd?: string;
  initialStatus?: TaskStatus;
  initialTaskKind?: TaskKind;
  initialLinks?: PendingLink[];
  initialLabelIds?: number[];
  initialProjectIds?: number[];
  taskId?: number;
  fromMemoId?: number;
  mode: 'create' | 'edit';
  onTaskCreated?: (taskId: number) => void;
  /** Pre-select this project when the form loads */
  initialProjectId?: number;
  /** This project cannot be deselected (locked) */
  lockedProjectId?: number;
  /** Callback when cancel is clicked (for modal usage) */
  onCancel?: () => void;
}

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

export default function TaskForm({
  initialTitle = '',
  initialBodyMd = '',
  initialStatus = 'inbox',
  initialTaskKind = 'action',
  initialLinks = [],
  initialLabelIds = [],
  initialProjectIds,
  taskId,
  fromMemoId,
  mode,
  onTaskCreated,
  initialProjectId,
  lockedProjectId,
  onCancel,
}: TaskFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(initialTitle);
  const [bodyMd, setBodyMd] = useState(initialBodyMd);
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [taskKind, setTaskKind] = useState<TaskKind>(initialTaskKind);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isUploading, uploadImage } = useImageUpload();

  // Schedule state (new fields)
  const [scheduleData, setScheduleData] = useState<ScheduleInputValue>({
    scheduledStart: null,
    scheduledEnd: null,
    isAllDay: false,
  });

  // Project/Label state
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
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isLabelOpen, setIsLabelOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(initialLinks.length > 0);
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>(initialLinks);

  const { addRecentProject, getRecentProjects } = useRecentProjects();
  const { addRecentLabel, getRecentLabels } = useRecentLabels();

  // Fetch projects and labels on mount (only for create mode)
  useEffect(() => {
    if (mode === 'create') {
      const fetchData = async () => {
        try {
          setLoadingData(true);
          const [projects, labels] = await Promise.all([
            ProjectsService.listProjects(),
            LabelsService.listLabels()
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
  }, [mode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate
    const validation = validateTaskForm(title, bodyMd, status);
    if (!validation.isValid) {
      const errorMessages = Object.values(validation.errors).join(', ');
      setValidationError(errorMessages || 'Invalid task data');
      return;
    }
    setValidationError(null);

    try {
      setSubmitting(true);
      setError(null);

      if (mode === 'create') {
        // Standard create flow — same path for both fresh task and memo promotion.
        // The promotion case adds an extra derived_from link at the end.
        const task = await TasksService.createTask({
          title,
          bodyMd: bodyMd || undefined,
          status,
          taskKind,
          scheduledStart: scheduleData.scheduledStart || undefined,
          scheduledEnd: scheduleData.scheduledEnd || undefined,
          isAllDay: scheduleData.isAllDay,
        });

        // Assign labels
        if (selectedLabelIds.length > 0) {
          await Promise.all(
            selectedLabelIds.map(labelId =>
              LabelsService.assignLabelToIssue(task.id.toString(), { labelId })
            )
          );
        }

        // Assign projects
        if (selectedProjectIds.length > 0) {
          await Promise.all(
            selectedProjectIds.map(projectId =>
              ProjectsService.addProjectItem(projectId.toString(), { issueId: task.id })
            )
          );
        }

        // Create links (both issue and URL links)
        if (pendingLinks.length > 0) {
          const linkResults = await Promise.allSettled([
            // Issue links
            ...pendingLinks
              .filter(isPendingIssueLink)
              .map(link =>
                LinksService.createLink({
                  sourceIssueId: task.id,
                  targetIssueId: link.targetIssueId,
                  linkType: link.linkType,
                })
              ),
            // URL links
            ...pendingLinks
              .filter(isPendingUrlLink)
              .map(link =>
                UrlLinksService.createUrlLink(String(task.id), {
                  url: link.url,
                  title: link.title,
                })
              ),
          ]);

          const failedLinks = linkResults.filter(result => result.status === 'rejected');
          if (failedLinks.length > 0) {
            console.warn(`Failed to create ${failedLinks.length} link(s):`, failedLinks);
          }
        }

        // For memo promotion: add derived_from link from the new task to the source memo
        if (fromMemoId) {
          try {
            await LinksService.createLink({
              sourceIssueId: task.id,
              targetIssueId: fromMemoId,
              linkType: 'derived_from',
            });
          } catch (err) {
            console.warn('Failed to create derived_from link to source memo:', err);
          }
        }

        if (onTaskCreated) {
          onTaskCreated(task.id);
        } else {
          navigate(`/tasks/${task.id}`);
        }
      } else if (mode === 'edit' && taskId) {
        await TasksService.updateTask(taskId.toString(), {
          title,
          bodyMd: bodyMd || undefined,
          status,
          taskKind,
        });
        navigate(`/tasks/${taskId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
      console.error('Error saving task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    // If onCancel callback is provided (modal usage), use it
    if (onCancel) {
      onCancel();
      return;
    }
    // Otherwise, use default navigation behavior
    if (mode === 'edit' && taskId) {
      navigate(`/tasks/${taskId}`);
    } else {
      navigate('/tasks');
    }
  };

  const handleKeyDown = useKeyboardShortcut((e) => {
    // Get the form that contains this input element
    const form = (e.target as HTMLElement).closest('form');
    if (form) {
      form.requestSubmit();
    }
  }, { disabled: submitting });

  // Image upload handlers
  const insertMarkdownRef = (markdownRef: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setBodyMd(prev => prev + '\n' + markdownRef);
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
    if (result.success && result.markdownRef) {
      insertMarkdownRef(result.markdownRef);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleImageFile(file);
        }
        return;
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleImageFile(files[0]);
    }
  };

  const handleToggleProject = (projectId: number) => {
    // Prevent deselecting the locked project
    if (lockedProjectId && projectId === lockedProjectId && selectedProjectIds.includes(projectId)) {
      return;
    }
    if (selectedProjectIds.includes(projectId)) {
      setSelectedProjectIds(selectedProjectIds.filter(id => id !== projectId));
    } else {
      setSelectedProjectIds([...selectedProjectIds, projectId]);
      addRecentProject(projectId);
    }
  };

  const handleToggleLabel = (labelId: number) => {
    if (selectedLabelIds.includes(labelId)) {
      setSelectedLabelIds(selectedLabelIds.filter(id => id !== labelId));
    } else {
      setSelectedLabelIds([...selectedLabelIds, labelId]);
      addRecentLabel(labelId);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;

    try {
      const newLabel = await LabelsService.createLabel({
        name: newLabelName.trim(),
      });

      // Add to list and select
      setAllLabels([...allLabels, newLabel]);
      setSelectedLabelIds([...selectedLabelIds, newLabel.id]);
      addRecentLabel(newLabel.id);

      // Reset form
      setNewLabelName('');
      setIsCreatingLabel(false);
    } catch (err) {
      console.error('Failed to create label:', err);
      setError(err instanceof Error ? err.message : 'Failed to create label');
    }
  };

  const handleAddLink = (link: PendingLink) => {
    setPendingLinks(prev => [...prev, link]);
  };

  const handleRemoveLink = (link: PendingLink) => {
    setPendingLinks(prev => prev.filter(l => l !== link));
  };

  const filteredProjects = allProjects.filter(p =>
    searchProjectQuery.trim()
      ? p.name.toLowerCase().includes(searchProjectQuery.toLowerCase())
      : true
  );

  const filteredLabels = allLabels.filter(l =>
    searchLabelQuery.trim()
      ? l.name.toLowerCase().includes(searchLabelQuery.toLowerCase())
      : true
  );

  const recentProjects = getRecentProjects(filteredProjects);
  const recentLabels = getRecentLabels(filteredLabels);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-red-600 text-xl">⚠</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error saving task</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          Task Title *
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-keyshortcuts="Control+Enter"
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500 ${validationError ? 'border-red-300' : 'border-gray-300'
            }`}
          placeholder="Enter task title..."
          required
        />
      </div>

      <div>
        <label htmlFor="bodyMd" className="block text-sm font-medium text-gray-700 mb-2">
          Task Description (Markdown, optional)
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
          placeholder="Enter task description in Markdown format..."
          disabled={submitting}
          isDragging={isDragging}
          isUploading={isUploading}
          minHeightClass="min-h-[200px]"
        />
        <p className="mt-1 text-xs text-gray-500">
          Optional. Supports Markdown formatting. Max 10,000 characters.
        </p>
      </div>

      {(mode === 'edit' || mode === 'create') && (
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500 appearance-none bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20viewBox%3d%220%200%2020%2020%22%20fill%3d%22%236b7280%22%3e%3cpath%20fill-rule%3d%22evenodd%22%20d%3d%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3d%22evenodd%22%2f%3e%3c%2fsvg%3e')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
          >
            <option value="inbox">Inbox</option>
            <option value="open">Open</option>
            <option value="next">Next</option>
            <option value="waiting">Waiting</option>
            <option value="scheduled">Scheduled</option>
            <option value="someday">Someday</option>
            <option value="done">Done</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
      )}

      {/* Kind Section */}
      {(mode === 'edit' || mode === 'create') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Kind
          </label>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setTaskKind('action')}
              className={`flex-1 px-3 py-2 text-sm ${
                taskKind === 'action'
                  ? 'bg-github-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Action
            </button>
            <button
              type="button"
              onClick={() => setTaskKind('event')}
              className={`flex-1 px-3 py-2 text-sm border-l border-gray-300 ${
                taskKind === 'event'
                  ? 'bg-github-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Event
            </button>
          </div>
        </div>
      )}

      {/* Schedule Section - Only for create mode */}
      {mode === 'create' && (
        <div className="border-b border-gray-200 pb-4">
          <button
            type="button"
            onClick={() => setIsScheduleOpen(!isScheduleOpen)}
            className="flex items-center justify-between w-full text-left mb-2 group"
          >
            <label className="block text-sm font-medium text-gray-700 cursor-pointer group-hover:text-gray-900">
              Schedule
            </label>
            <span className="text-gray-400 group-hover:text-gray-600">
              {isScheduleOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </span>
          </button>

          {isScheduleOpen && (
            <div className="mt-2">
              <ScheduleInput
                value={scheduleData}
                onChange={setScheduleData}
              />
            </div>
          )}

          {!isScheduleOpen && scheduleData.scheduledStart && (
            <div className="text-sm text-gray-600 mt-1">
              Scheduled: {scheduleData.scheduledStart.split('T')[0]}
              {!scheduleData.isAllDay && scheduleData.scheduledStart.split('T')[1] && ` @ ${scheduleData.scheduledStart.split('T')[1].slice(0, 5)}`}
              {scheduleData.isAllDay && ' (All day)'}
            </div>
          )}
        </div>
      )}

      {/* Projects Section - Only for create mode */}
      {mode === 'create' && (
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => {
                setIsProjectOpen(!isProjectOpen);
                if (!loadingData && allProjects.length === 0) {
                  // Load data if not loaded
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
              <span className="text-gray-400 group-hover:text-gray-600">
                {isProjectOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </span>
            </button>
          </div>

          {/* Selected Projects Display */}
          {selectedProjectIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedProjectIds.map(id => {
                const project = allProjects.find(p => p.id === id);
                const isLocked = lockedProjectId === id;
                return project ? (
                  <span key={id} className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${isLocked ? 'bg-github-green-100 text-github-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {project.name}
                    {isLocked ? (
                      <span className="ml-1.5 text-github-green-600" title="This project cannot be removed">✓</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleProject(id)}
                        className="ml-1.5 inline-flex items-center justify-center hover:text-gray-600"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ) : null;
              })}
            </div>
          )}

          {/* Accordion Content */}
          {isProjectOpen && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col" style={{ maxHeight: '300px' }}>
              {/* Search */}
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
                  {/* Recent Projects */}
                  {recentProjects.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Recent</h4>
                      <div className="space-y-1">
                        {recentProjects.map(project => {
                          const isLocked = lockedProjectId === project.id;
                          return (
                          <label key={project.id} className={`flex items-center gap-2 px-2 py-1.5 rounded ${isLocked ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={selectedProjectIds.includes(project.id)}
                              onChange={() => handleToggleProject(project.id)}
                              disabled={isLocked}
                              style={{ accentColor: '#16a34a', colorScheme: 'light' }}
                              className="w-4 h-4 rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-900 truncate">{project.name}</span>
                            {isLocked && <span className="text-xs text-gray-400">(locked)</span>}
                          </label>
                        );})}
                      </div>
                    </div>
                  )}

                  {/* All Projects */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Organization</h4>
                    <div className="space-y-1">
                      {filteredProjects.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-gray-500 text-center">
                          {searchProjectQuery.trim() ? 'No projects match your search' : 'No projects available'}
                        </div>
                      ) : (
                        filteredProjects.map(project => {
                          const isLocked = lockedProjectId === project.id;
                          return (
                          <label key={project.id} className={`flex items-center gap-2 px-2 py-1.5 rounded ${isLocked ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={selectedProjectIds.includes(project.id)}
                              onChange={() => handleToggleProject(project.id)}
                              disabled={isLocked}
                              style={{ accentColor: '#16a34a', colorScheme: 'light' }}
                              className="w-4 h-4 rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-900 truncate">{project.name}</span>
                            {isLocked && <span className="text-xs text-gray-400">(locked)</span>}
                          </label>
                        );})
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Labels Section - Only for create mode */}
      {mode === 'create' && (
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => {
                setIsLabelOpen(!isLabelOpen);
                if (!loadingData && allLabels.length === 0) {
                  // Load data if not loaded
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
              <span className="text-gray-400 group-hover:text-gray-600">
                {isLabelOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </span>
            </button>
          </div>

          {/* Selected Labels Display */}
          {selectedLabelIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedLabelIds.map(id => {
                const label = allLabels.find(l => l.id === id);
                return label ? (
                  <span key={id} className="inline-flex items-center gap-1">
                    <LabelBadge name={label.name} />
                    <button
                      type="button"
                      onClick={() => handleToggleLabel(id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}

          {/* Accordion Content */}
          {isLabelOpen && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col" style={{ maxHeight: '300px' }}>
              {/* Search */}
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
                  {/* Create Label */}
                  {isCreatingLabel ? (
                    <div className="mb-3 p-3 border border-gray-300 rounded bg-white">
                      <input
                        type="text"
                        placeholder="Label name"
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-sm"
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
                          type="button"
                          onClick={handleCreateLabel}
                          disabled={!newLabelName.trim()}
                          className="px-3 py-1 bg-github-green-600 text-white rounded text-sm hover:bg-github-green-700 disabled:opacity-50"
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingLabel(false);
                            setNewLabelName('');
                          }}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCreatingLabel(true)}
                      className="w-full mb-3 px-2 py-1.5 text-sm text-github-green-600 hover:bg-gray-50 rounded flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create new label
                    </button>
                  )}

                  {/* Recent Labels */}
                  {recentLabels.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Recent</h4>
                      <div className="space-y-1">
                        {recentLabels.map(label => (
                          <label key={label.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedLabelIds.includes(label.id)}
                              onChange={() => handleToggleLabel(label.id)}
                              style={{ accentColor: '#16a34a', colorScheme: 'light' }}
                              className="w-4 h-4 rounded border-gray-300"
                            />
                            <LabelBadge name={label.name} />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Labels */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">All Labels</h4>
                    <div className="space-y-1">
                      {filteredLabels.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-gray-500 text-center">
                          {searchLabelQuery.trim() ? 'No labels match your search' : 'No labels available'}
                        </div>
                      ) : (
                        filteredLabels.map(label => (
                          <label key={label.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedLabelIds.includes(label.id)}
                              onChange={() => handleToggleLabel(label.id)}
                              style={{ accentColor: '#16a34a', colorScheme: 'light' }}
                              className="w-4 h-4 rounded border-gray-300"
                            />
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

      {/* Links Section - Only for create mode */}
      {mode === 'create' && (
        <div className="border-b border-gray-200 pb-4">
          <button
            type="button"
            onClick={() => setIsLinksOpen(!isLinksOpen)}
            className="flex items-center justify-between w-full text-left mb-2 group"
          >
            <label className="block text-sm font-medium text-gray-700 cursor-pointer group-hover:text-gray-900">
              Links
              {pendingLinks.length > 0 && (
                <span className="ml-2 text-xs text-gray-500">
                  ({pendingLinks.length})
                </span>
              )}
            </label>
            <span className="text-gray-400 group-hover:text-gray-600">
              {isLinksOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </span>
          </button>

          {isLinksOpen && (
            <div className="mt-2">
              <TaskFormLinks
                links={pendingLinks}
                onAdd={handleAddLink}
                onRemove={handleRemoveLink}
                disabled={submitting}
              />
            </div>
          )}

          {!isLinksOpen && pendingLinks.length > 0 && (
            <div className="text-sm text-gray-600 mt-1">
              {pendingLinks.length} link(s) configured
            </div>
          )}
        </div>
      )}

      {validationError && (
        <p className="text-sm text-red-600">{validationError}</p>
      )}

      <div className="flex items-center justify-end space-x-3">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={submitting}
          title={`Save (${getShortcutHint()})`}
        >
          {submitting ? 'Saving...' : mode === 'create' ? 'Create Task' : 'Update Task'}
        </button>
      </div>
    </form>
  );
}
