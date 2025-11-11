# Keyboard Shortcuts Implementation - Quick Reference

## Exploration Overview
Complete technical analysis for implementing Cmd/Ctrl+Enter keyboard shortcuts on Save and Comment buttons.

**Files Created:**
1. `FINDINGS_SUMMARY.md` - Comprehensive exploration results (16KB)
2. `keyboard_shortcuts_context.md` - Technical context and patterns (11KB)
3. `code_examples_keyboard_shortcuts.md` - Code snippets and examples (10KB)
4. `QUICK_REFERENCE.md` - This file

---

## Key Components to Modify

### 1. TaskForm.tsx
- **Path:** `/packages/web/src/components/TaskForm.tsx`
- **Focus:** Textarea at line 128 (bodyMd field)
- **Handler:** `handleSubmit()` at lines 34-80
- **Button:** Line 183-189 (type="submit")

### 2. MemoForm.tsx
- **Path:** `/packages/web/src/components/MemoForm.tsx`
- **Focus:** Textarea at line 77 (bodyMd field)
- **Handler:** `handleSubmit()` at lines 19-47
- **Button:** Line 104-110 (type="submit")

### 3. CommentSection.tsx
- **Path:** `/packages/web/src/components/CommentSection.tsx`
- **Focus:** Textarea at line 109 (comment input)
- **Handler:** `handleSubmitNewComment()` at lines 43-60
- **Button:** Line 117-123 (type="submit")

### 4. EditableContent.tsx
- **Path:** `/packages/web/src/components/EditableContent.tsx`
- **Focus:** Textarea at line 121 (edit mode)
- **Handlers:** `handleSaveEdit()` & `handleCancelEdit()`
- **Button:** Line 134-140 (Save button)
- **Bonus:** Add Escape key to cancel editing

---

## Implementation Pattern

### Step 1: Add Keyboard Handler
```tsx
const handleFormKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    const form = (e.target as HTMLElement).closest('form');
    form?.dispatchEvent(new Event('submit', { bubbles: true }));
  }
};
```

### Step 2: Attach to Textarea
```tsx
<textarea
  id="bodyMd"
  value={bodyMd}
  onChange={(e) => setBodyMd(e.target.value)}
  onKeyDown={handleFormKeyDown}  // ADD THIS LINE
  // ... rest of props
/>
```

### Step 3: Add Button Tooltip
```tsx
<button
  type="submit"
  title="Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)"
  // ... rest of props
>
  Save
</button>
```

---

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2.0 | UI framework |
| TypeScript | 5.5.4 | Type safety |
| Vite | 7.1.11 | Build tool |
| React Router DOM | 7.9.4 | Routing |
| Tailwind CSS | 4.1.14 | Styling |
| Vitest | 1.6.0 | Unit testing |
| React Testing Library | 16.3.0 | Component testing |
| Playwright | 1.56.1 | E2E testing |

---

## Testing Setup

### Test Location
`/packages/web/tests/unit/`

### Test Pattern
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskForm from '../../src/components/TaskForm';

describe('TaskForm - Keyboard Shortcuts', () => {
  it('should submit form on Cmd+Enter', async () => {
    render(<TaskForm mode="create" />);
    const textarea = screen.getByPlaceholderText('...');
    
    fireEvent.keyDown(textarea, {
      key: 'Enter',
      metaKey: true,
    });
    
    // Assert submission occurred
  });
});
```

### Run Tests
```bash
cd /packages/web
pnpm test
```

---

## Reference Implementation

**SearchInput.tsx** (lines 73-78) - Only existing keyboard handler
```tsx
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSearch();
  }
};
```

Extend this pattern for Cmd/Ctrl+Enter combinations.

---

## Critical Files Summary

| File | Type | Lines | Key Points |
|------|------|-------|-----------|
| TaskForm.tsx | Form | 193 | 3 modes, validation, navigation |
| MemoForm.tsx | Form | 114 | 2 modes, minimal fields |
| CommentSection.tsx | Form | 128 | Inline submission, append to list |
| EditableContent.tsx | Edit | 150 | Inline mode, escape for cancel |
| SearchInput.tsx | Reference | 127 | Existing keyboard handler pattern |
| vite.config.ts | Config | 25 | Test configuration (jsdom) |

---

## Browser Compatibility

- **Mac:** Use `e.metaKey` (Cmd key)
- **Windows/Linux:** Use `e.ctrlKey` (Ctrl key)
- **Web Standard:** Both always available as event properties

```tsx
if ((e.metaKey || e.ctrlKey) && e.key === 'Enter')
```

---

## Implementation Checklist

### Phase 1: TaskForm.tsx
- [ ] Add `handleFormKeyDown` handler
- [ ] Attach `onKeyDown` to textarea
- [ ] Add button tooltip
- [ ] Write unit tests (Cmd+Enter, Ctrl+Enter, Enter alone)

### Phase 2: MemoForm.tsx
- [ ] Same as Phase 1 (reuse handler pattern or custom hook)

### Phase 3: CommentSection.tsx
- [ ] Add `handleCommentKeyDown` handler
- [ ] Attach `onKeyDown` to comment textarea
- [ ] Add button tooltip
- [ ] Write unit tests

### Phase 4: EditableContent.tsx
- [ ] Add `handleEditKeyDown` handler for Cmd/Ctrl+Enter (save)
- [ ] Add Escape key handling (cancel)
- [ ] Write unit tests for both shortcuts

### Phase 5: ProjectForm.tsx (Optional)
- [ ] Same pattern as MemoForm

### Phase 6: Documentation
- [ ] Update README with keyboard shortcuts
- [ ] Add E2E tests with Playwright
- [ ] Create user-facing help text

---

## Key Event Properties

```tsx
e.metaKey    // Cmd on Mac, Windows key on Windows (but use ctrlKey instead)
e.ctrlKey    // Ctrl on Windows/Linux, also available on Mac
e.key        // 'Enter' (string value of pressed key)
e.preventDefault() // Prevents newline insertion in textarea
```

---

## Common Pitfalls

1. **Forgetting preventDefault()** - Textarea will add newline
2. **Using only metaKey** - Won't work on Windows/Linux
3. **Not checking both metaKey and ctrlKey** - Platform-specific failures
4. **Not testing Enter without modifiers** - Should NOT submit
5. **Forgetting to add tooltips** - Users won't know about shortcuts

---

## Support Resources

- React 19 docs: https://react.dev
- Keyboard Events: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
- Vitest docs: https://vitest.dev
- React Testing Library: https://testing-library.com/react

---

## Estimated Timeline

- TaskForm.tsx: 1-2 hours
- MemoForm.tsx: 30 minutes
- CommentSection.tsx: 1-2 hours
- EditableContent.tsx: 1-2 hours
- Testing & Documentation: 2-3 hours
- **Total: 6-10 hours**

---

## Related Documentation

- **Full Analysis:** `FINDINGS_SUMMARY.md`
- **Technical Context:** `keyboard_shortcuts_context.md`
- **Code Examples:** `code_examples_keyboard_shortcuts.md`
- **Project Guide:** `CLAUDE.md`

---

**Last Updated:** November 11, 2025  
**React Version:** 19.2.0  
**TypeScript Version:** 5.5.4
