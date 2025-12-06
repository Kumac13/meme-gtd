import { useState, FormEvent, useRef, DragEvent, ClipboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';
import { StatusSelector } from './StatusSelector';
import { useImageUpload } from '../hooks/useImageUpload';

const PROJECT_STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'done', label: 'Done' },
  { value: 'canceled', label: 'Canceled' },
];

interface ProjectFormProps {
  mode: 'create';
}

export default function ProjectForm(_props: ProjectFormProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('planned');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isUploading, uploadImage } = useImageUpload();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      setError('Start date must be before or equal to end date');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          view: 'board',
          status,
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create project');
      }

      const project = await response.json();
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = useKeyboardShortcut(() => {
    const form = document.querySelector('form');
    if (form) {
      form.requestSubmit();
    }
  }, { disabled: submitting });

  // Image upload handlers
  const insertMarkdownRef = (markdownRef: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setDescription(prev => prev + '\n' + markdownRef);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = description.slice(0, start);
    const after = description.slice(end);

    const newValue = before + (before.endsWith('\n') || before === '' ? '' : '\n') + markdownRef + '\n' + after;
    setDescription(newValue);

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

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Project Name *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-keyshortcuts="Control+Enter"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-transparent"
            placeholder="Enter project name"
            disabled={submitting}
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            ref={textareaRef}
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-keyshortcuts="Control+Enter"
            rows={4}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-transparent ${isDragging ? 'border-github-green-500 bg-github-green-50' : 'border-gray-300'} ${isUploading ? 'opacity-50' : ''}`}
            placeholder="Enter project description (optional)"
            disabled={submitting || isUploading}
          />
          {isUploading && (
            <div className="mt-1 text-xs text-gray-500">Uploading image...</div>
          )}
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <StatusSelector
            value={status}
            onChange={setStatus}
            options={PROJECT_STATUS_OPTIONS}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-transparent box-border overflow-hidden"
              style={{ WebkitAppearance: 'none', appearance: 'none' }}
              disabled={submitting}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-transparent box-border overflow-hidden"
              style={{ WebkitAppearance: 'none', appearance: 'none' }}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-github-green-600 text-white rounded-md hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Create Project (${getShortcutHint()})`}
          >
            {submitting ? 'Creating...' : 'Create Project'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/projects')}
            disabled={submitting}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
