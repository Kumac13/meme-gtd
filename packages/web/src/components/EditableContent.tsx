import { useCallback, useState, useRef } from 'react';
import type { IssueType } from 'meme-gtd-shared';
import { formatRelativeTime } from '../utils/dates';
import { MarkdownRenderer } from '../utils/markdown';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { useTodoMutation } from '../hooks/useTodoMutation';
import { MarkdownTextarea } from './MarkdownTextarea';
import { ActionMenu } from './ActionMenu';

interface EditableContentProps {
  content: string;
  createdAt: string;
  updatedAt: string;
  onSave: (content: string, title?: string) => Promise<void>;
  onDelete: () => Promise<void>;
  title?: string | null;
  showTitleEdit?: boolean;
  enableInteractiveTodos?: boolean;
  /**
   * Hide the Edit action (Copy/Delete stay available). Used for web-saved
   * articles whose body is an archived snapshot (issues.origin='web').
   */
  readOnly?: boolean;
  /**
   * Click handler for internal issue links inside the rendered body
   * (used by ItemDetail to mirror LinkSection's modal-open behavior).
   */
  onIssueLinkClick?: (id: number, type: IssueType) => void;
}

export default function EditableContent({
  content,
  createdAt,
  updatedAt,
  onSave,
  onDelete,
  title,
  showTitleEdit = false,
  enableInteractiveTodos = false,
  readOnly = false,
  onIssueLinkClick,
}: EditableContentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState(content);
  const [editingTitle, setEditingTitle] = useState(title || '');
  const [saving, setSaving] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    await copy(content);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditingContent(content);
    setEditingTitle(title || '');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingContent(content);
    setEditingTitle(title || '');
  };

  const handleSaveEdit = async () => {
    // For tasks with title edit, allow empty body if title exists
    // For memos (no title edit), body is required
    if (!showTitleEdit && !editingContent.trim()) return;
    if (showTitleEdit && !editingTitle.trim() && !editingContent.trim()) return;

    try {
      setSaving(true);
      await onSave(editingContent, showTitleEdit ? editingTitle : undefined);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving content:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    await onDelete();
  };

  const todoSave = useCallback(
    async (next: string) => {
      await onSave(next);
    },
    [onSave],
  );

  const { content: displayContent, onToggle: handleTodoToggle, onReorder: handleTodoReorder } = useTodoMutation({
    content,
    save: todoSave,
    onError: (err) => console.error('Todo update failed:', err),
  });

  // Determine if save should be disabled
  const isSaveDisabled = saving || (
    showTitleEdit
      ? (!editingTitle.trim() && !editingContent.trim())  // Task: need title or body
      : !editingContent.trim()  // Memo: need body
  );

  const handleKeyDown = useKeyboardShortcut(() => handleSaveEdit(), {
    disabled: isSaveDisabled,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg py-1 px-4">
      <div className="flex items-center justify-between py-1 border-b border-gray-200">
        <div className="text-xs text-gray-500">
          <span title={updatedAt}>{formatRelativeTime(updatedAt)}</span>
          {updatedAt !== createdAt && <span className="ml-2 text-gray-500">(edited)</span>}
        </div>
        {!isEditing && (
          <ActionMenu
            items={[
              ...(!readOnly ? [{ label: 'Edit', onSelect: handleStartEdit }] : []),
              { label: copied ? 'Copied!' : 'Copy', onSelect: handleCopy },
              { label: 'Delete', onSelect: handleDelete, destructive: true },
            ]}
          />
        )}
      </div>

      {isEditing ? (
        <div>
          {showTitleEdit && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-keyshortcuts="Control+Enter"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500"
                placeholder="Task title"
              />
            </div>
          )}
          <MarkdownTextarea
            textareaRef={textareaRef}
            value={editingContent}
            onChange={setEditingContent}
            onKeyDown={handleKeyDown}
            rows={6}
            disabled={false}
            minHeightClass="min-h-[100px]"
          />
          <div className="mt-2 flex justify-end space-x-2">
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={isSaveDisabled}
              className="px-3 py-1 text-sm bg-github-green-600 text-white rounded-md hover:bg-github-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Save (${getShortcutHint()})`}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm max-w-none mt-1 break-words">
          <MarkdownRenderer
            content={enableInteractiveTodos ? displayContent : content}
            interactiveTodos={
              enableInteractiveTodos
                ? {
                    enabled: true,
                    onToggle: handleTodoToggle,
                    onReorder: handleTodoReorder,
                  }
                : undefined
            }
            onIssueLinkClick={onIssueLinkClick}
          />
        </div>
      )}
    </div>
  );
}
