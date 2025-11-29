import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { ProjectsService } from '../api/services/ProjectsService';
import { LabelsService } from '../api/services/LabelsService';
import { LinksService } from '../api/services/LinksService';
import { validateMemoBody } from '../utils/validation';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';
import { useRecentProjects } from '../hooks/useRecentProjects';
import { useRecentLabels } from '../hooks/useRecentLabels';
import { LabelBadge } from './LabelBadge';

interface MemoFormProps {
  initialBodyMd?: string;
  memoId?: number;
  mode: 'create' | 'edit';
  fromTaskId?: number;
  initialLabels?: string[];
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

export default function MemoForm({ initialBodyMd = '', memoId, mode, fromTaskId, initialLabels }: MemoFormProps) {
  const navigate = useNavigate();
  const [bodyMd, setBodyMd] = useState(initialBodyMd);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Project/Label state
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchProjectQuery, setSearchProjectQuery] = useState('');
  const [searchLabelQuery, setSearchLabelQuery] = useState('');
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isLabelOpen, setIsLabelOpen] = useState(false);

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

          // Pre-select labels from initialLabels (when coming from a task)
          if (initialLabels && initialLabels.length > 0) {
            const labelIds = labels
              .filter((l: Label) => initialLabels.includes(l.name))
              .map((l: Label) => l.id);
            setSelectedLabelIds(labelIds);
          }
        } catch (err) {
          console.error('Failed to fetch projects/labels:', err);
        } finally {
          setLoadingData(false);
        }
      };
      fetchData();
    }
  }, [mode, initialLabels]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate
    const validation = validateMemoBody(bodyMd);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid memo body');
      return;
    }
    setValidationError(null);

    try {
      setSubmitting(true);
      setError(null);

      if (mode === 'create') {
        const memo = await MemosService.createMemo({ bodyMd });

        // Create derived_from link if coming from a task
        if (fromTaskId) {
          await LinksService.createLink({
            sourceIssueId: memo.id,
            targetIssueId: fromTaskId,
            linkType: 'derived_from',
          });
        }

        // Assign labels
        if (selectedLabelIds.length > 0) {
          await Promise.all(
            selectedLabelIds.map(labelId =>
              LabelsService.assignLabelToIssue(memo.id.toString(), { labelId })
            )
          );
        }

        // Assign projects
        if (selectedProjectIds.length > 0) {
          await Promise.all(
            selectedProjectIds.map(projectId =>
              ProjectsService.addProjectItem(projectId.toString(), { issueId: memo.id })
            )
          );
        }

        navigate(`/memos/${memo.id}`);
      } else if (mode === 'edit' && memoId) {
        await MemosService.updateMemo(memoId.toString(), { bodyMd });
        navigate(`/memos/${memoId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save memo');
      console.error('Error saving memo:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (mode === 'edit' && memoId) {
      navigate(`/memos/${memoId}`);
    } else {
      navigate('/memos');
    }
  };

  const handleKeyDown = useKeyboardShortcut(() => {
    const form = document.querySelector('form');
    if (form) {
      form.requestSubmit();
    }
  }, { disabled: submitting });

  const handleToggleProject = (projectId: number) => {
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
              <h3 className="text-sm font-medium text-red-800">Error saving memo</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="bodyMd" className="block text-sm font-medium text-gray-700 mb-2">
          Memo Content (Markdown)
        </label>
        <textarea
          id="bodyMd"
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-keyshortcuts="Control+Enter"
          rows={15}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500 font-mono text-sm ${validationError ? 'border-red-300' : 'border-gray-300'
            }`}
          placeholder="Enter your memo content in Markdown format..."
        />
        {validationError && (
          <p className="mt-1 text-sm text-red-600">{validationError}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Supports Markdown formatting. Max 10,000 characters.
        </p>
      </div>

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
                return project ? (
                  <span key={id} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                    {project.name}
                    <button
                      type="button"
                      onClick={() => handleToggleProject(id)}
                      className="ml-1.5 inline-flex items-center justify-center hover:text-gray-600"
                    >
                      ×
                    </button>
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
                        {recentProjects.map(project => (
                          <label key={project.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedProjectIds.includes(project.id)}
                              onChange={() => handleToggleProject(project.id)}
                              style={{ accentColor: '#16a34a', colorScheme: 'light' }}
                              className="w-4 h-4 rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-900 truncate">{project.name}</span>
                          </label>
                        ))}
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
                        filteredProjects.map(project => (
                          <label key={project.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedProjectIds.includes(project.id)}
                              onChange={() => handleToggleProject(project.id)}
                              style={{ accentColor: '#16a34a', colorScheme: 'light' }}
                              className="w-4 h-4 rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-900 truncate">{project.name}</span>
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
      )
      }

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
          {submitting ? 'Saving...' : mode === 'create' ? 'Create Memo' : 'Update Memo'}
        </button>
      </div>
    </form >
  );
}
