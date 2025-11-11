# Web UI Technical Context for Keyboard Shortcuts (Cmd/Ctrl+Enter)

## 1. Current Web UI Framework & Technology

### Stack
- **Framework**: React 19.2.0 (latest)
- **Language**: TypeScript 5.5.4
- **Build Tool**: Vite 7.1.11
- **Routing**: React Router DOM 7.9.4
- **Styling**: Tailwind CSS 4.1.14
- **Component Icons**: React Icons 5.5.0
- **Testing**: Vitest 1.6.0 + React Testing Library 16.3.0 + Playwright (e2e)

### Supporting Libraries
- `@dnd-kit/core` & `@dnd-kit/sortable` - Drag and drop functionality
- `react-markdown` - Markdown rendering with `remark-gfm` and `remark-breaks`
- `jsdom` - DOM simulation for testing

## 2. Package Structure

```
/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/
├── src/
│   ├── components/              # React components
│   │   ├── TaskForm.tsx        # Task create/edit form
│   │   ├── MemoForm.tsx        # Memo create/edit form
│   │   ├── ProjectForm.tsx     # Project create form
│   │   ├── CommentSection.tsx  # Comment submission form
│   │   ├── EditableContent.tsx # Edit inline content
│   │   ├── SearchInput.tsx     # Search input (has keyboard handling)
│   │   └── ...
│   ├── pages/                  # Page components (route handlers)
│   │   ├── TaskNew.tsx
│   │   ├── TaskEdit.tsx
│   │   ├── MemoNew.tsx
│   │   ├── MemoEdit.tsx
│   │   ├── ProjectNew.tsx
│   │   ├── MemoDetail.tsx
│   │   ├── TaskDetail.tsx
│   │   └── ...
│   ├── hooks/                  # Custom React hooks
│   ├── api/                    # API service clients
│   │   ├── services/
│   │   │   ├── TasksService.ts
│   │   │   ├── MemosService.ts
│   │   │   ├── CommentsService.ts
│   │   │   └── ...
│   │   └── ...
│   ├── utils/                  # Utilities
│   │   ├── validation.ts
│   │   ├── markdown.tsx
│   │   └── ...
│   └── App.tsx                 # Main router setup
├── tests/
│   ├── setup.ts               # Test setup
│   └── unit/                  # Unit tests
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 3. Forms with Save Buttons

### 3.1 TaskForm.tsx
**Location**: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/TaskForm.tsx`

**Form Fields**:
- Title input (text)
- Body markdown textarea (10,000 char max)
- Status select (open/next/waiting/scheduled/done/canceled)

**Save Button Structure** (line 183-189):
```tsx
<button
  type="submit"
  className="px-4 py-2 border border-transparent rounded-md shadow-sm 
             text-sm font-medium text-white bg-github-green-600 
             hover:bg-github-green-700 focus:outline-none 
             focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 
             disabled:opacity-50 disabled:cursor-not-allowed"
  disabled={submitting}
>
  {submitting ? 'Saving...' : mode === 'create' ? 'Create Task' : 'Update Task'}
</button>
```

**Submit Handler**: `handleSubmit` (lines 34-80)
- Validates form data using `validateTaskForm()`
- Sets `submitting` state during submission
- Handles three modes: create, create-from-memo, edit

**Pages Using**:
- `/tasks/new` (TaskNew.tsx)
- `/tasks/:id/edit` (TaskEdit.tsx)

---

### 3.2 MemoForm.tsx
**Location**: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/MemoForm.tsx`

**Form Fields**:
- Body markdown textarea (10,000 char max, 15 rows)

**Save Button Structure** (line 104-110):
```tsx
<button
  type="submit"
  className="px-4 py-2 border border-transparent rounded-md shadow-sm 
             text-sm font-medium text-white bg-github-green-600 
             hover:bg-github-green-700 focus:outline-none 
             focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 
             disabled:opacity-50 disabled:cursor-not-allowed"
  disabled={submitting}
>
  {submitting ? 'Saving...' : mode === 'create' ? 'Create Memo' : 'Update Memo'}
</button>
```

**Submit Handler**: `handleSubmit` (lines 19-47)
- Validates form data using `validateMemoBody()`
- Sets `submitting` state during submission
- Handles two modes: create, edit

**Pages Using**:
- `/memos/new` (MemoNew.tsx)
- `/memos/:id/edit` (MemoEdit.tsx)

---

### 3.3 ProjectForm.tsx
**Location**: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/ProjectForm.tsx`

**Form Fields**:
- Name input (required, text)
- Description textarea (optional)

**Save Button Structure** (line 94-100):
```tsx
<button
  type="submit"
  disabled={submitting}
  className="px-4 py-2 bg-github-green-600 text-white rounded-md 
             hover:bg-github-green-700 focus:outline-none 
             focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 
             disabled:opacity-50 disabled:cursor-not-allowed"
>
  {submitting ? 'Creating...' : 'Create Project'}
</button>
```

**Submit Handler**: `handleSubmit` (lines 15-51)
- Validates project name is not empty
- Uses fetch() directly (not service client)
- Handles create mode only

**Pages Using**:
- `/projects/new` (ProjectNew.tsx)

---

### 3.4 EditableContent.tsx (Inline Edit)
**Location**: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/EditableContent.tsx`

**Edit Mode Save Button** (line 134-140):
```tsx
<button
  onClick={handleSaveEdit}
  disabled={saving || !editingContent.trim()}
  className="px-3 py-1 text-sm bg-github-green-600 text-white rounded-md 
             hover:bg-github-green-700 disabled:opacity-50 
             disabled:cursor-not-allowed"
>
  {saving ? 'Saving...' : 'Save'}
</button>
```

**Save Handler**: `handleSaveEdit` (lines 42-54)
- Used for inline editing of comments and task/memo details
- Calls `onSave()` callback with new content

**Used In**:
- CommentSection.tsx (editing existing comments)
- Task/Memo detail views (potentially for inline edits)

## 4. Forms with Comment Buttons

### CommentSection.tsx
**Location**: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/CommentSection.tsx`

**Comment Form** (lines 108-125):
```tsx
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
  <div className="mt-2 flex justify-end">
    <button
      type="submit"
      disabled={submitting || !newCommentBody.trim()}
      className="px-4 py-2 bg-github-green-600 text-white rounded-md 
                 hover:bg-github-green-700 focus:outline-none 
                 focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 
                 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {submitting ? 'Commenting...' : 'Comment'}
    </button>
  </div>
</form>
```

**Submit Handler**: `handleSubmitNewComment` (lines 43-60)
- Validates comment body is not empty via `.trim()`
- Handles both task and memo comments via `itemType` prop
- Uses CommentsService for API calls
- Appends new comment to state

**Used In**:
- TaskDetail.tsx
- MemoDetail.tsx

## 5. Existing Keyboard Event Handling Patterns

### SearchInput.tsx (Reference Pattern)
**Location**: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/SearchInput.tsx`

**Implementation** (lines 73-78):
```tsx
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSearch();
  }
};

// Usage in input:
<input
  type="text"
  value={localValue}
  onChange={handleInputChange}
  onKeyDown={handleKeyDown}
  // ...
/>
```

**Pattern Observations**:
- Uses `onKeyDown` event (not onKeyPress, which is deprecated)
- Checks `e.key === 'Enter'`
- Calls `e.preventDefault()` to stop default form submission
- Delegates to named handler function
- Simple, clean implementation

### Cross-Platform Keyboard Shortcuts Pattern Needed
For Cmd/Ctrl+Enter support, will need:
```tsx
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    handleSubmit(e as any); // Need to adapt form submission
  }
};
```

## 6. Testing Setup

### Test Framework Stack
- **Test Runner**: Vitest 1.6.0 (Vite-native)
- **Component Testing**: React Testing Library 16.3.0
- **DOM Simulation**: jsdom (configured in vite.config.ts)
- **E2E Testing**: Playwright 1.56.1
- **Test Utilities**: @testing-library/jest-dom 6.9.1

### Configuration Files
- **Vite Config**: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/vite.config.ts`
  - globals: true (no need to import describe/it)
  - environment: jsdom
  - setupFiles: ./tests/setup.ts
  - Excludes: node_modules, dist, e2e

- **Test Setup**: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/tests/setup.ts`
  - Imports @testing-library/jest-dom for assertion helpers

### Example Unit Test Pattern
**Location**: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/tests/unit/queryParser.test.ts`

```tsx
import { describe, it, expect } from 'vitest';
import { parseSearchQuery } from '../../src/utils/queryParser';

describe('queryParser', () => {
  it('should return empty object for empty string', () => {
    expect(parseSearchQuery('')).toEqual({});
  });
});
```

### Running Tests
```bash
pnpm test          # Run unit tests (from web package)
pnpm test:e2e      # Run Playwright e2e tests
```

## 7. Implementation Opportunities

### For TaskForm.tsx - Keyboard Shortcut Support
1. Add `onKeyDown` handler to form or textarea
2. Detect Cmd/Ctrl+Enter combination
3. Call `handleSubmit()` directly
4. Add visual indicator (e.g., help text, button tooltip)

### For MemoForm.tsx - Same Pattern
1. Add `onKeyDown` handler to textarea
2. Detect Cmd/Ctrl+Enter
3. Delegate to existing `handleSubmit()`

### For CommentSection.tsx - Comment Submission Shortcut
1. Add `onKeyDown` handler to comment textarea
2. Detect Cmd/Ctrl+Enter
3. Call `handleSubmitNewComment()` directly

### For EditableContent.tsx - Inline Edit Shortcut
1. Add `onKeyDown` to edit textarea
2. Detect Cmd/Ctrl+Enter for save
3. Detect Escape for cancel

### Testing Strategy
- Unit test keyboard handlers with Vitest
- Mock form submission functions
- Use @testing-library/user-event for simulating key combinations
- E2E test with Playwright for real user flows

## Summary of Key Files

| File | Purpose | Has Save Button | Line Numbers |
|------|---------|-----------------|--------------|
| TaskForm.tsx | Task create/edit form | Yes | 34-80 (submit), 183-189 (button) |
| MemoForm.tsx | Memo create/edit form | Yes | 19-47 (submit), 104-110 (button) |
| ProjectForm.tsx | Project create form | Yes | 15-51 (submit), 94-100 (button) |
| EditableContent.tsx | Inline content editing | Yes | 42-54 (save), 134-140 (button) |
| CommentSection.tsx | Comment submission | Yes | 43-60 (submit), 117-123 (button) |
| SearchInput.tsx | Search with Enter key | No | 73-78 (keyboard handler) |
| vite.config.ts | Test configuration | N/A | 19-24 |
| tests/setup.ts | Test setup | N/A | All |

## React Version Note
React 19.2.0 with React Router 7.9.4 is relatively recent (2024+). This provides:
- Latest hooks API support
- Excellent TypeScript support
- Form handling via FormEvent types
- Stable ref handling for keyboard detection
