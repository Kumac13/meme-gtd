# Keyboard Shortcuts Implementation - Code Examples

## Key Forms to Enhance

### 1. TaskForm.tsx - Pattern for Form Keyboard Handler

**Current Structure:**
```tsx
interface TaskFormProps {
  initialTitle?: string;
  initialBodyMd?: string;
  initialStatus?: TaskStatus;
  taskId?: number;
  fromMemoId?: number;
  mode: 'create' | 'edit';
}

export default function TaskForm({
  initialTitle = '',
  initialBodyMd = '',
  initialStatus = 'open',
  taskId,
  fromMemoId,
  mode,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [bodyMd, setBodyMd] = useState(initialBodyMd);
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // ... form submission logic
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form fields */}
    </form>
  );
}
```

**Where to Add Keyboard Handler:**
- Textarea element (bodyMd field) around line 127-134
- Form element itself around line 91

**Implementation Pattern:**
```tsx
const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  // Cmd+Enter on Mac, Ctrl+Enter on Windows/Linux
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    // Trigger form submission
    const form = (e.target as HTMLTextAreaElement).closest('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    }
  }
};
```

---

### 2. MemoForm.tsx - Similar Pattern

**Textarea Location:** Lines 77-86

**Same keyboard handler pattern applies**

---

### 3. CommentSection.tsx - Comment Keyboard Handler

**Current Structure:**
```tsx
const handleSubmitNewComment = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newCommentBody.trim()) return;

  try {
    setSubmitting(true);
    const newComment =
      itemType === 'memo'
        ? await CommentsService.createMemoComment(String(itemId), { bodyMd: newCommentBody })
        : await CommentsService.createTaskComment(String(itemId), { bodyMd: newCommentBody });
    setComments([...comments, newComment]);
    setNewCommentBody('');
  } catch (error) {
    console.error('Error creating comment:', error);
  } finally {
    setSubmitting(false);
  }
};

return (
  <form onSubmit={handleSubmitNewComment} className="bg-white border border-gray-200 rounded-lg p-4">
    <textarea
      value={newCommentBody}
      onChange={(e) => setNewCommentBody(e.target.value)}
      placeholder="Write a comment..."
      className="w-full px-3 py-2 border border-gray-300 rounded-md 
                 focus:outline-none focus:ring-2 focus:ring-github-green-500 
                 min-h-[100px]"
      disabled={submitting}
    />
    {/* Submit button at line 117 */}
  </form>
);
```

**Implementation Pattern:**
```tsx
const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    // Call handleSubmitNewComment as if form was submitted
    handleSubmitNewComment({
      preventDefault: () => {},
      target: { value: newCommentBody },
    } as any);
  }
};
```

---

### 4. EditableContent.tsx - Inline Edit Handler

**Current Structure:**
```tsx
const handleSaveEdit = async () => {
  if (!editingContent.trim()) return;

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

const handleCancelEdit = () => {
  setIsEditing(false);
  setEditingContent(content);
  setEditingTitle(title || '');
};

return (
  <>
    {isEditing ? (
      <div>
        <textarea
          value={editingContent}
          onChange={(e) => setEditingContent(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md 
                     focus:outline-none focus:ring-2 focus:ring-github-green-500 
                     min-h-[100px]"
        />
        <button onClick={handleSaveEdit}>Save</button>
        <button onClick={handleCancelEdit}>Cancel</button>
      </div>
    ) : (
      // Display mode
    )}
  </>
);
```

**Implementation Pattern:**
```tsx
const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  // Cmd/Ctrl+Enter to save
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    handleSaveEdit();
  }
  // Escape to cancel
  else if (e.key === 'Escape') {
    e.preventDefault();
    handleCancelEdit();
  }
};
```

---

## Reference: Existing SearchInput.tsx Pattern

**Location:** `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/SearchInput.tsx`

**Current Implementation (lines 73-78):**
```tsx
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSearch();
  }
};

// Usage:
<input
  type="text"
  value={localValue}
  onChange={handleInputChange}
  onKeyDown={handleKeyDown}
  placeholder={placeholder}
  className="..."
/>
```

---

## Test Examples (Vitest Pattern)

### Testing Keyboard Shortcuts

**File:** `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/tests/unit/keyboard-shortcuts.test.ts` (NEW)

**Pattern:**
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskForm from '../../src/components/TaskForm';

describe('TaskForm - Keyboard Shortcuts', () => {
  it('should submit form on Cmd+Enter (Mac)', async () => {
    const handleSubmit = vi.fn();
    render(<TaskForm mode="create" />);
    
    const textarea = screen.getByPlaceholderText('Enter task description in Markdown format...');
    
    await userEvent.type(textarea, 'Test task');
    
    // Simulate Cmd+Enter on Mac
    fireEvent.keyDown(textarea, {
      key: 'Enter',
      code: 'Enter',
      metaKey: true,  // Cmd key on Mac
    });
    
    // Assert form submission occurred
    // (may need to check loading state or API call)
  });

  it('should submit form on Ctrl+Enter (Windows/Linux)', async () => {
    const textarea = screen.getByPlaceholderText('Enter task description...');
    
    await userEvent.type(textarea, 'Test task');
    
    // Simulate Ctrl+Enter on Windows
    fireEvent.keyDown(textarea, {
      key: 'Enter',
      code: 'Enter',
      ctrlKey: true,  // Ctrl key on Windows
    });
    
    // Assert form submission
  });

  it('should not submit on Enter without modifier key', async () => {
    const textarea = screen.getByPlaceholderText('Enter task description...');
    
    await userEvent.type(textarea, 'Test task{Enter}');
    
    // Form should NOT submit (just add newline to textarea)
    // This is standard textarea behavior
  });
});

describe('CommentSection - Keyboard Shortcuts', () => {
  it('should submit comment on Cmd+Enter', async () => {
    render(
      <CommentSection itemId={1} itemType="task" />
    );
    
    const textarea = screen.getByPlaceholderText('Write a comment...');
    
    await userEvent.type(textarea, 'Test comment');
    
    fireEvent.keyDown(textarea, {
      key: 'Enter',
      metaKey: true,
    });
    
    // Assert comment was submitted
  });
});

describe('EditableContent - Keyboard Shortcuts', () => {
  it('should save on Cmd+Enter in edit mode', async () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <EditableContent
        content="Original"
        createdAt="2024-01-01"
        updatedAt="2024-01-01"
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );
    
    // Enter edit mode
    const editButton = screen.getByText('Edit');
    await userEvent.click(editButton);
    
    const textarea = screen.getByDisplayValue('Original');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Updated');
    
    // Trigger Cmd+Enter
    fireEvent.keyDown(textarea, {
      key: 'Enter',
      metaKey: true,
    });
    
    expect(onSave).toHaveBeenCalledWith('Updated', undefined);
  });

  it('should cancel edit on Escape', async () => {
    render(
      <EditableContent
        content="Original"
        createdAt="2024-01-01"
        updatedAt="2024-01-01"
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    
    const editButton = screen.getByText('Edit');
    await userEvent.click(editButton);
    
    const textarea = screen.getByDisplayValue('Original');
    
    fireEvent.keyDown(textarea, { key: 'Escape' });
    
    // Should return to display mode
    expect(screen.queryByDisplayValue('Original')).not.toBeInTheDocument();
  });
});
```

---

## UX Considerations

### Button Label/Help Text Addition

**For TaskForm.tsx button (lines 183-189):**
```tsx
<div className="flex items-center justify-end space-x-3">
  <button
    type="button"
    onClick={handleCancel}
    className="..."
    disabled={submitting}
  >
    Cancel
  </button>
  <button
    type="submit"
    className="..."
    disabled={submitting}
    title="Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)"
  >
    {submitting ? 'Saving...' : mode === 'create' ? 'Create Task' : 'Update Task'}
    <span className="text-xs text-gray-300 ml-2">⌘↩</span> {/* Mac shortcut hint */}
  </button>
</div>
```

### Alternative: Toast/Help Message
```tsx
{/* Near form top or button */}
<p className="text-xs text-gray-500">
  💡 Tip: Use <kbd>Cmd</kbd>+<kbd>Enter</kbd> (Mac) or <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (Windows/Linux) to save
</p>
```

---

## Browser API Notes

**keyboard events in React (form submission context):**

```tsx
// Type definitions for form submission via keyboard
const handleKeyboardSubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    
    // Method 1: Dispatch form event
    const form = (e.currentTarget || e.target as HTMLElement).closest('form');
    form?.dispatchEvent(new Event('submit', { bubbles: true }));
    
    // Method 2: Call handler directly
    // handleSubmit({
    //   preventDefault: () => {},
    // } as React.FormEvent);
  }
};
```

**Key Properties:**
- `e.metaKey` - Cmd on Mac, Windows key on Windows
- `e.ctrlKey` - Ctrl on Windows/Linux, also available on Mac
- `e.key` - 'Enter' string value
- `e.preventDefault()` - Prevents newline insertion in textarea
