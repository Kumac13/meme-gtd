# Web UI Technical Context - Keyboard Shortcuts Implementation
## Exploration Summary

### Quick Overview

I have completed a comprehensive exploration of the meme-gtd Web UI codebase to gather technical context for implementing Cmd/Ctrl+Enter keyboard shortcuts for Save and Comment buttons.

**Exploration Date:** November 11, 2025  
**Duration:** Complete codebase scan including component hierarchy, form patterns, and testing setup

---

## Key Findings Summary

### 1. Web UI Technology Stack (Current)

#### Primary Stack
- **React:** 19.2.0 (Latest as of 2024)
- **TypeScript:** 5.5.4 (Strict mode)
- **Build Tool:** Vite 7.1.11 (Fast development experience)
- **Router:** React Router DOM 7.9.4 (Modern routing)
- **Styling:** Tailwind CSS 4.1.14 (Utility-first CSS)

#### Testing Infrastructure
- **Unit Testing:** Vitest 1.6.0 (Vite-native test runner)
- **Component Testing:** React Testing Library 16.3.0
- **E2E Testing:** Playwright 1.56.1
- **DOM Simulation:** jsdom (for unit tests)

**Significance:** Modern, well-maintained stack with excellent TypeScript support and testing capabilities. No outdated dependencies or legacy patterns.

---

### 2. Project Structure

**Root Directory:** `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/`

```
packages/web/
├── src/
│   ├── components/        ← PRIMARY FOCUS (Form components)
│   ├── pages/             ← Route handlers
│   ├── hooks/             ← Custom React hooks
│   ├── api/              ← API service clients
│   ├── utils/            ← Helper utilities
│   └── App.tsx           ← Router setup
├── tests/
│   ├── setup.ts          ← Test initialization
│   └── unit/             ← Unit test files
├── vite.config.ts        ← Vite & test configuration
└── package.json
```

**Critical Files for Keyboard Shortcuts:**
- `src/components/TaskForm.tsx` (Primary target)
- `src/components/MemoForm.tsx` (Primary target)
- `src/components/CommentSection.tsx` (Primary target)
- `src/components/EditableContent.tsx` (Secondary target)
- `src/components/SearchInput.tsx` (Reference implementation)

---

### 3. Forms Identified - Save Buttons

#### TaskForm.tsx
**Location:** `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/TaskForm.tsx`

**Characteristics:**
- 193 lines total
- Supports 3 modes: create, create-from-memo, edit
- Form fields:
  - Title input (required, text)
  - Body markdown textarea (10,000 char max)
  - Status select (6 options: open/next/waiting/scheduled/done/canceled)
- Save button: Line 183-189 (type="submit")
- Submit handler: `handleSubmit()` at lines 34-80
  - Validates via `validateTaskForm()`
  - Manages `submitting` state
  - Navigates after successful save
- **Pages Using:** `/tasks/new`, `/tasks/:id/edit`

**Implementation Ready:** YES - Clean structure, form-based, perfect for Cmd/Ctrl+Enter

---

#### MemoForm.tsx
**Location:** `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/MemoForm.tsx`

**Characteristics:**
- 114 lines total
- Supports 2 modes: create, edit
- Form fields:
  - Body markdown textarea (10,000 char max, 15 rows)
- Save button: Line 104-110 (type="submit")
- Submit handler: `handleSubmit()` at lines 19-47
  - Validates via `validateMemoBody()`
  - Manages `submitting` state
  - Navigates after successful save
- **Pages Using:** `/memos/new`, `/memos/:id/edit`

**Implementation Ready:** YES - Minimal, clean form

---

#### ProjectForm.tsx
**Location:** `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/ProjectForm.tsx`

**Characteristics:**
- 113 lines total
- Supports 1 mode: create only
- Form fields:
  - Name input (required)
  - Description textarea (optional)
- Save button: Line 94-100 (type="submit")
- Submit handler: `handleSubmit()` at lines 15-51
  - Uses `fetch()` directly (not service client)
  - Validates project name not empty
- **Pages Using:** `/projects/new`

**Implementation Ready:** YES - Create-only form

---

#### EditableContent.tsx
**Location:** `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/EditableContent.tsx`

**Characteristics:**
- 150 lines total
- Inline edit component (modal/inline editing pattern)
- Save button: Line 134-140 (onClick={handleSaveEdit})
- Save handler: `handleSaveEdit()` at lines 42-54
- Cancel handler: `handleCancelEdit()` at lines 36-40
- **Used In:** CommentSection.tsx (editing existing comments)

**Implementation Ready:** YES - Already has edit/cancel pattern, good for Escape key too

---

### 4. Forms Identified - Comment Buttons

#### CommentSection.tsx
**Location:** `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/CommentSection.tsx`

**Characteristics:**
- 128 lines total
- Comment submission form (lines 108-125)
- Textarea: Line 109-115 (placeholder: "Write a comment...")
- Comment button: Line 117-123 (type="submit")
- Submit handler: `handleSubmitNewComment()` at lines 43-60
  - Validates comment not empty via `.trim()`
  - Handles both task and memo comments via `itemType` prop
  - Uses `CommentsService` API client
  - Appends new comment to state
  - Clears textarea after submission
  - Sets `submitting` state
- **Used In:** TaskDetail.tsx, MemoDetail.tsx

**Implementation Ready:** YES - Clean form, excellent for Cmd/Ctrl+Enter shortcut

---

### 5. Existing Keyboard Event Handling

#### SearchInput.tsx (Reference Pattern)
**Location:** `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/SearchInput.tsx`

**Current Implementation:**
```tsx
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSearch();
  }
};

<input
  type="text"
  value={localValue}
  onChange={handleInputChange}
  onKeyDown={handleKeyDown}
  placeholder={placeholder}
  className="..."
/>
```

**Pattern Observations:**
- Uses `onKeyDown` event handler (not deprecated onKeyPress)
- Checks `e.key === 'Enter'` (modern keyboard API)
- Calls `e.preventDefault()` to stop default behavior
- Delegates to named handler function
- Simple, clean implementation

**Significance:** This is the ONLY existing keyboard handler in the web UI codebase. The pattern is clean and modern - perfect to extend for Cmd/Ctrl+Enter combinations.

---

### 6. Testing Framework Setup

#### Configuration
- **Test Runner:** Vitest 1.6.0
- **Environment:** jsdom (DOM simulation for unit tests)
- **Config Location:** `vite.config.ts` (lines 19-24)
- **Setup File:** `tests/setup.ts` (imports @testing-library/jest-dom)
- **Test Pattern:** Functional, not class-based

#### Vite Config (Relevant Section)
```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './tests/setup.ts',
  exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
}
```

**Significance:** Global test utilities (describe/it available without imports), jsdom for DOM testing, clean setup.

#### Example Test File Pattern
**Location:** `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/tests/unit/queryParser.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parseSearchQuery } from '../../src/utils/queryParser';

describe('queryParser', () => {
  it('should return empty object for empty string', () => {
    expect(parseSearchQuery('')).toEqual({});
  });
});
```

**Testing Recommendations for Keyboard Shortcuts:**
1. Use Vitest with jsdom environment
2. Import from `vitest`: describe, it, expect, vi (for mocking)
3. Import from `@testing-library/react`: render, screen, fireEvent
4. Test both Mac (metaKey) and Windows (ctrlKey) key combinations
5. Verify form submission occurs on keyboard shortcut
6. Verify Escape key cancels inline edits

---

### 7. Component Integration Points

#### Pages Using Forms

**Task-Related:**
- `pages/TaskNew.tsx` → Uses `TaskForm` with mode="create"
- `pages/TaskEdit.tsx` → Uses `TaskForm` with mode="edit"
- `pages/TaskDetail.tsx` → Uses `CommentSection` for comments

**Memo-Related:**
- `pages/MemoNew.tsx` → Uses `MemoForm` with mode="create"
- `pages/MemoEdit.tsx` → Uses `MemoForm` with mode="edit"
- `pages/MemoDetail.tsx` → Uses `CommentSection` for comments

**Project-Related:**
- `pages/ProjectNew.tsx` → Uses `ProjectForm` with mode="create"

**Routing:**
- All pages wrap forms in `Layout` component
- Router uses React Router DOM 7.9.4
- Base routes: `/tasks`, `/memos`, `/projects`

#### API Integration
- Forms use service clients: `TasksService`, `MemosService`, `CommentsService`
- Located in: `src/api/services/`
- Handle HTTP requests and error handling
- Forms don't need to be modified for API - just keyboard shortcuts at UI layer

---

### 8. Key Implementation Challenges & Solutions

#### Challenge 1: Form Submission from Keyboard
**Problem:** onKeyDown handler needs to trigger form submission

**Solution Options:**
1. **Option A (Recommended):** Use form element's `dispatchEvent()` to trigger submit event
   ```tsx
   const form = (e.target as HTMLElement).closest('form');
   form?.dispatchEvent(new Event('submit', { bubbles: true }));
   ```

2. **Option B:** Call handler function directly (less standard)
   ```tsx
   const handleSubmit = async (e: FormEvent) => { /* ... */ };
   handleSubmit({ preventDefault: () => {} } as FormEvent);
   ```

**Chosen:** Option A - respects form submission pipeline

---

#### Challenge 2: Detecting Cmd vs Ctrl Across Platforms
**Problem:** Different platforms use different modifier keys

**Solution:**
```tsx
if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
  // Mac: metaKey (Cmd)
  // Windows/Linux: ctrlKey (Ctrl)
  // Web standard: Both are always available
}
```

**Significance:** One code path works for all platforms

---

#### Challenge 3: Preventing Newline on Cmd/Ctrl+Enter
**Problem:** TextArea default behavior is to add newline even with modifiers

**Solution:** `e.preventDefault()` before any other handling

---

#### Challenge 4: Testing Keyboard Combinations
**Problem:** Vitest with fireEvent requires proper event simulation

**Solution:** Use `fireEvent.keyDown()` with metaKey/ctrlKey flags
```tsx
fireEvent.keyDown(textarea, {
  key: 'Enter',
  metaKey: true,  // or ctrlKey: true
});
```

---

### 9. UX Considerations for Implementation

#### Button Tooltips/Help Text
- Add `title` attribute to save buttons
- Show platform-appropriate shortcut text
- Examples:
  - Mac: "Cmd+Enter"
  - Windows/Linux: "Ctrl+Enter"

#### Visual Indicators
- Option 1: Keyboard shortcut hint next to button
- Option 2: Tooltip on hover
- Option 3: Help text in form header

#### Accessibility
- Don't remove mouse functionality
- Keep submit button clickable
- Maintain keyboard tab order
- Add aria-labels if helpful text added

---

## Implementation Roadmap

### Phase 1: TaskForm.tsx (1 form, 1 textarea)
1. Add `onKeyDown` handler to bodyMd textarea (line 128)
2. Detect Cmd/Ctrl+Enter combination
3. Dispatch form submit event
4. Add tooltip to save button
5. Write unit tests for both key combinations

### Phase 2: MemoForm.tsx (1 form, 1 textarea)
1. Same pattern as TaskForm
2. Reuse keyboard handler logic (or extract to custom hook)

### Phase 3: CommentSection.tsx (1 form, 1 textarea)
1. Add `onKeyDown` handler to comment textarea (line 111)
2. Call `handleSubmitNewComment()` directly on Cmd/Ctrl+Enter
3. Add tooltip to comment button
4. Write unit tests

### Phase 4: EditableContent.tsx (2 textareas in edit mode)
1. Content textarea: Cmd/Ctrl+Enter to save
2. Content textarea: Escape to cancel
3. Optional: Title textarea: Escape to cancel
4. Write unit tests for both key combinations

### Phase 5: ProjectForm.tsx (Optional, lower priority)
1. Same pattern as MemoForm
2. Only has name+description (no validation difference)

### Phase 6: Documentation & Testing
1. Update UI documentation with keyboard shortcut info
2. Create E2E tests with Playwright
3. Document keyboard shortcuts in README

---

## Files Modified Summary

| Component | File Path | Lines | Modification Type |
|-----------|-----------|-------|-------------------|
| TaskForm.tsx | `src/components/TaskForm.tsx` | 128-134 | Add onKeyDown handler |
| MemoForm.tsx | `src/components/MemoForm.tsx` | 77-86 | Add onKeyDown handler |
| CommentSection.tsx | `src/components/CommentSection.tsx` | 109-115 | Add onKeyDown handler |
| EditableContent.tsx | `src/components/EditableContent.tsx` | 121-125 | Add onKeyDown handler |
| Tests | `tests/unit/keyboard-shortcuts.test.ts` | NEW | Unit tests |

---

## Critical Code Paths

### For Save Buttons (TaskForm, MemoForm, ProjectForm)
**Submission flow:**
1. Keyboard handler detects Cmd/Ctrl+Enter
2. Calls `e.preventDefault()`
3. Dispatches form submit event
4. Form's `onSubmit` handler (`handleSubmit`) executes
5. Validation runs
6. API call made via service client
7. Component state updates
8. Navigation occurs (if create/edit mode)

### For Comment Button (CommentSection)
**Submission flow:**
1. Keyboard handler detects Cmd/Ctrl+Enter
2. Calls `e.preventDefault()`
3. Calls `handleSubmitNewComment()` directly
4. Validation runs (check comment not empty)
5. API call made via CommentsService
6. Comments array updated
7. Textarea cleared
8. UI updates with new comment

### For Inline Edit (EditableContent)
**Submission flow (Save):**
1. Keyboard handler detects Cmd/Ctrl+Enter
2. Calls `handleSaveEdit()`
3. Calls `onSave()` callback with content
4. Parent component updates content via API
5. Edit mode exits

**Cancellation flow (Escape):**
1. Keyboard handler detects Escape
2. Calls `handleCancelEdit()`
3. Reverts to display mode
4. No API call

---

## Testing Coverage Plan

### Unit Tests (Vitest)
- Cmd+Enter submission on each form type
- Ctrl+Enter submission on Windows/Linux
- Enter without modifiers (should NOT submit)
- Multiple Cmd/Ctrl presses
- Escape key cancellation on EditableContent
- Empty field validation still works

### E2E Tests (Playwright)
- Full task creation flow with Cmd/Ctrl+Enter
- Full comment submission with keyboard
- Inline edit save/cancel with keyboard
- Cross-browser testing (Chrome, Firefox, Safari)

### Manual Testing Checklist
- Mac: Cmd+Enter on all forms
- Windows: Ctrl+Enter on all forms
- Linux: Ctrl+Enter on all forms
- Tab to textarea, use keyboard only
- Mouse still works after keyboard use
- Mobile: Touch keyboard behavior (might not support modifiers)

---

## References

**Exploration Files Created:**
1. `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/keyboard_shortcuts_context.md` - Full technical context
2. `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/code_examples_keyboard_shortcuts.md` - Code examples and patterns

**Key Source Files:**
- TaskForm.tsx - `/packages/web/src/components/TaskForm.tsx`
- MemoForm.tsx - `/packages/web/src/components/MemoForm.tsx`
- ProjectForm.tsx - `/packages/web/src/components/ProjectForm.tsx`
- CommentSection.tsx - `/packages/web/src/components/CommentSection.tsx`
- EditableContent.tsx - `/packages/web/src/components/EditableContent.tsx`
- SearchInput.tsx - `/packages/web/src/components/SearchInput.tsx` (reference)
- vite.config.ts - `/packages/web/vite.config.ts` (test setup)

---

## Conclusion

The meme-gtd Web UI codebase is well-structured with:
- **Modern React 19** with TypeScript strict mode
- **Clean form components** with clear submission patterns
- **Existing keyboard handling** precedent (SearchInput.tsx)
- **Comprehensive testing setup** with Vitest
- **Consistent styling** with Tailwind CSS
- **No conflicting shortcuts** currently in place

**Readiness Level:** READY FOR IMPLEMENTATION

All form components follow consistent patterns and are located in predictable locations. The existing keyboard event handling in SearchInput provides an excellent reference implementation. Testing infrastructure is fully in place and configured.

**Estimated Implementation Time:** 2-3 days (4-5 forms + tests + documentation)

---

**Exploration Date:** November 11, 2025  
**Codebase Version:** Latest from main branch  
**React Version:** 19.2.0  
**TypeScript Version:** 5.5.4
