# Quick Start: Implementing Keyboard Shortcuts

**Feature**: Keyboard Shortcuts for Save and Comment Actions
**Estimated Time**: 6-10 hours
**Difficulty**: ⭐⭐ (Intermediate)

## Prerequisites

- Node.js 22+
- pnpm installed
- Familiarity with React 19 and TypeScript
- Understanding of keyboard event handling

## Overview

This feature adds Cmd+Enter (macOS) or Ctrl+Enter (Windows/Linux) keyboard shortcuts to trigger Save and Comment actions in the Web UI. It's a pure frontend enhancement requiring no backend changes.

## Setup

1. **Ensure you're on the feature branch**:
   ```bash
   git checkout 026-webui-save-comment
   ```

2. **Install dependencies** (if not already installed):
   ```bash
   pnpm install
   ```

3. **Start the development server**:
   ```bash
   # Terminal 1: Start test API server (port 3001)
   pnpm server:dev

   # Terminal 2: Start web dev server (port 5173)
   cd packages/web
   pnpm dev
   ```

4. **Verify setup**:
   - Web UI: http://localhost:5173
   - Test API: http://localhost:3001

## Implementation Roadmap

### Phase 1: Core Utilities (1-2 hours)

Create reusable utilities for keyboard shortcuts and OS detection.

#### Step 1.1: Create keyboard utility

**File**: `packages/web/src/utils/keyboard.ts` (new file)

```typescript
/**
 * Detects if the user is on macOS
 */
export function isMacOS(): boolean {
  return /Mac|iPhone|iPod|iPad/.test(navigator.platform);
}

/**
 * Gets the keyboard shortcut hint for the current OS
 */
export function getShortcutHint(): string {
  return isMacOS() ? '⌘+Enter' : 'Ctrl+Enter';
}

/**
 * Checks if a keyboard event is Cmd/Ctrl+Enter
 */
export function isSubmitShortcut(e: React.KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.key === 'Enter';
}
```

**Test**: Create `packages/web/tests/utils/keyboard.test.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { isMacOS, getShortcutHint, isSubmitShortcut } from '../../src/utils/keyboard';

describe('keyboard utilities', () => {
  const originalPlatform = navigator.platform;

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      writable: true
    });
  });

  test('detects macOS', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      writable: true
    });
    expect(isMacOS()).toBe(true);
  });

  test('detects non-macOS', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      writable: true
    });
    expect(isMacOS()).toBe(false);
  });

  test('returns correct shortcut hint for macOS', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      writable: true
    });
    expect(getShortcutHint()).toBe('⌘+Enter');
  });

  test('returns correct shortcut hint for Windows', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      writable: true
    });
    expect(getShortcutHint()).toBe('Ctrl+Enter');
  });

  test('detects Cmd+Enter', () => {
    const event = {
      metaKey: true,
      ctrlKey: false,
      key: 'Enter'
    } as React.KeyboardEvent;
    expect(isSubmitShortcut(event)).toBe(true);
  });

  test('detects Ctrl+Enter', () => {
    const event = {
      metaKey: false,
      ctrlKey: true,
      key: 'Enter'
    } as React.KeyboardEvent;
    expect(isSubmitShortcut(event)).toBe(true);
  });

  test('ignores plain Enter', () => {
    const event = {
      metaKey: false,
      ctrlKey: false,
      key: 'Enter'
    } as React.KeyboardEvent;
    expect(isSubmitShortcut(event)).toBe(false);
  });
});
```

#### Step 1.2: Create custom hook

**File**: `packages/web/src/hooks/useKeyboardShortcut.ts` (new file)

```typescript
import { useCallback } from 'react';
import { isSubmitShortcut } from '../utils/keyboard';

interface UseKeyboardShortcutOptions {
  disabled?: boolean;
}

/**
 * Custom hook for Cmd/Ctrl+Enter keyboard shortcuts
 * @param callback - Function to call when shortcut is triggered
 * @param options - Configuration options
 * @returns Keyboard event handler
 */
export function useKeyboardShortcut(
  callback: () => void,
  options?: UseKeyboardShortcutOptions
) {
  return useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (options?.disabled) return;

      if (isSubmitShortcut(e)) {
        e.preventDefault(); // Prevent newline in textarea
        callback();
      }
    },
    [callback, options?.disabled]
  );
}
```

**Test**: Create `packages/web/tests/hooks/useKeyboardShortcut.test.ts`

```typescript
import { describe, test, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcut } from '../../src/hooks/useKeyboardShortcut';

describe('useKeyboardShortcut', () => {
  test('calls callback on Cmd+Enter', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useKeyboardShortcut(callback));

    const event = {
      metaKey: true,
      key: 'Enter',
      preventDefault: vi.fn()
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

    result.current(event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  test('does not call callback when disabled', () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardShortcut(callback, { disabled: true })
    );

    const event = {
      metaKey: true,
      key: 'Enter',
      preventDefault: vi.fn()
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

    result.current(event);

    expect(callback).not.toHaveBeenCalled();
  });
});
```

**Verify**: Run tests
```bash
cd packages/web
pnpm test keyboard.test
pnpm test useKeyboardShortcut.test
```

---

### Phase 2: Component Integration (4-6 hours)

Integrate keyboard shortcuts into existing components.

#### Step 2.1: TaskForm Component

**File**: `packages/web/src/components/TaskForm.tsx`

**Changes**:

1. Import utilities:
```typescript
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';
```

2. Add keyboard handler (after `handleSubmit` function):
```typescript
const handleKeyDown = useKeyboardShortcut(handleSubmit, {
  disabled: isSubmitting
});
```

3. Update textarea (find the textarea around line 128):
```typescript
<textarea
  value={editedTitle}
  onChange={(e) => setEditedTitle(e.target.value)}
  onKeyDown={handleKeyDown}  // ADD THIS
  aria-keyshortcuts="Control+Enter"  // ADD THIS
  className="..."
/>
```

4. Update Save button tooltip (around line 183):
```typescript
<button
  type="submit"
  disabled={isSubmitting}
  title={`Save (${getShortcutHint()})`}  // ADD THIS
  className="..."
>
  Save
</button>
```

**Test**: Update `packages/web/tests/components/TaskForm.test.tsx`

Add this test:
```typescript
import userEvent from '@testing-library/user-event';

test('saves task with Cmd+Enter', async () => {
  const mockOnSave = vi.fn();
  render(<TaskForm onSave={mockOnSave} />);

  const titleInput = screen.getByLabelText(/title/i);
  await userEvent.type(titleInput, 'New task{Meta>}{Enter}{/Meta}');

  expect(mockOnSave).toHaveBeenCalledTimes(1);
  expect(mockOnSave).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'New task' })
  );
});

test('does not save with plain Enter', async () => {
  const mockOnSave = vi.fn();
  render(<TaskForm onSave={mockOnSave} />);

  const titleInput = screen.getByLabelText(/title/i);
  await userEvent.type(titleInput, 'New task{Enter}');

  expect(mockOnSave).not.toHaveBeenCalled();
});

test('keyboard shortcut respects validation', async () => {
  const mockOnSave = vi.fn();
  render(<TaskForm onSave={mockOnSave} />);

  const titleInput = screen.getByLabelText(/title/i);
  // Don't type anything - empty title should fail validation
  await userEvent.click(titleInput);
  await userEvent.keyboard('{Meta>}{Enter}{/Meta}');

  expect(mockOnSave).not.toHaveBeenCalled();
});
```

**Verify**:
```bash
pnpm test TaskForm.test
```

#### Step 2.2: MemoForm Component

**File**: `packages/web/src/components/MemoForm.tsx`

**Changes**: Similar to TaskForm (see pattern above)

1. Import utilities
2. Add `handleKeyDown` with `useKeyboardShortcut`
3. Add `onKeyDown={handleKeyDown}` to textarea (around line 77)
4. Add `aria-keyshortcuts="Control+Enter"` to textarea
5. Update Save button title with `getShortcutHint()` (around line 104)

**Test**: Update `packages/web/tests/components/MemoForm.test.tsx` with similar tests

#### Step 2.3: CommentSection Component

**File**: `packages/web/src/components/CommentSection.tsx`

**Changes**: Similar pattern, but for comment submission

1. Import utilities
2. Add `handleKeyDown` that calls `handleSubmitNewComment`
3. Update textarea (around line 109) with `onKeyDown` and `aria-keyshortcuts`
4. Update Comment button title (around line 117)

**Test**: Update `packages/web/tests/components/CommentSection.test.tsx`

#### Step 2.4: EditableContent Component

**File**: `packages/web/src/components/EditableContent.tsx`

**Changes**: Similar pattern, but also handle Cancel with Escape key

1. Import utilities
2. Add two handlers:
   - `handleSaveKeyDown` for Cmd/Ctrl+Enter → save
   - `handleCancelKeyDown` for Escape → cancel (optional enhancement)
3. Update textarea (around line 121)
4. Update Save button title (around line 134)

**Test**: Update `packages/web/tests/components/EditableContent.test.tsx`

---

### Phase 3: Testing & Verification (2-3 hours)

#### Step 3.1: Run all tests

```bash
cd packages/web
pnpm test
```

**Expected**: All tests pass with new keyboard shortcut tests included

#### Step 3.2: Manual testing checklist

Start the dev server and test:

- [ ] TaskForm: Cmd/Ctrl+Enter saves task
- [ ] TaskForm: Plain Enter does NOT save (inserts newline)
- [ ] TaskForm: Save button shows correct tooltip (⌘+Enter or Ctrl+Enter)
- [ ] TaskForm: Keyboard shortcut respects validation
- [ ] TaskForm: Keyboard shortcut disabled when submitting
- [ ] MemoForm: Cmd/Ctrl+Enter saves memo
- [ ] MemoForm: Tooltip and validation work correctly
- [ ] CommentSection: Cmd/Ctrl+Enter submits comment
- [ ] CommentSection: Comment field clears after submission
- [ ] EditableContent: Cmd/Ctrl+Enter saves edit
- [ ] All forms: No duplicate submissions on rapid key presses

#### Step 3.3: Browser compatibility testing

Test in:
- [ ] Chrome (macOS and Windows if available)
- [ ] Firefox
- [ ] Safari (macOS)
- [ ] Edge (Windows if available)

#### Step 3.4: Accessibility testing

- [ ] Screen reader announces `aria-keyshortcuts`
- [ ] Keyboard-only navigation works (Tab, Shift+Tab, Enter, Escape)
- [ ] Visual focus indicators visible
- [ ] Tooltips readable with high contrast

---

## Common Patterns

### Adding keyboard shortcut to a new form

```typescript
// 1. Import
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';

// 2. Add handler in component
const handleKeyDown = useKeyboardShortcut(handleSubmit, {
  disabled: isSubmitting
});

// 3. Update textarea
<textarea
  onKeyDown={handleKeyDown}
  aria-keyshortcuts="Control+Enter"
  // ... other props
/>

// 4. Update button
<button
  type="submit"
  title={`Save (${getShortcutHint()})`}
>
  Save
</button>
```

### Testing pattern

```typescript
test('saves with Cmd+Enter', async () => {
  const mockOnSave = vi.fn();
  render(<YourForm onSave={mockOnSave} />);

  const input = screen.getByRole('textbox');
  await userEvent.type(input, 'Content{Meta>}{Enter}{/Meta}');

  expect(mockOnSave).toHaveBeenCalledTimes(1);
});
```

## Troubleshooting

### Keyboard shortcut not working

1. **Check disabled state**: Is `isSubmitting` true? Handler is disabled during submission
2. **Check event propagation**: Is `preventDefault()` being called elsewhere?
3. **Check validation**: Does the form pass validation? Invalid forms won't submit
4. **Console log**: Add `console.log('Key pressed:', e.key, e.metaKey, e.ctrlKey)` to debug

### Tests failing

1. **Check imports**: Ensure `userEvent` is imported from `@testing-library/user-event`
2. **Check event syntax**: Use `{Meta>}{Enter}{/Meta}` for Cmd+Enter
3. **Wait for async**: Use `await` with `userEvent.type()` and `userEvent.keyboard()`
4. **Check mocks**: Ensure callback functions are mocked with `vi.fn()`

### Tooltip not showing correct shortcut

1. **Check browser platform**: Test in actual macOS/Windows, not DevTools emulation
2. **Check `navigator.platform`**: Log `navigator.platform` to verify detection
3. **Clear cache**: Hard refresh (Cmd/Ctrl+Shift+R)

## Performance Notes

- Keyboard event handlers are lightweight (<0.1ms execution)
- Early return on non-matching keys prevents unnecessary processing
- No re-renders triggered unless submission occurs
- No performance monitoring needed for this feature

## Next Steps

After implementation is complete:

1. **Create PR**: Follow project git workflow
2. **Documentation**: Update user-facing docs if needed
3. **Changelog**: Add entry to CHANGELOG.md (see `docs/versioning.md`)
4. **Version bump**: Follow versioning guidelines (likely PATCH version)

## Resources

- [React Keyboard Events](https://react.dev/reference/react-dom/components/common#keyboardevent-handler)
- [Testing Library User Events](https://testing-library.com/docs/user-event/intro)
- [WCAG Keyboard Accessibility](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html)
- [Feature Spec](./spec.md)
- [Research Document](./research.md)

## Support

For questions or issues:
1. Check [Troubleshooting](#troubleshooting) section above
2. Review existing keyboard handler in `SearchInput.tsx` (reference implementation)
3. Consult project maintainers

---

**Estimated Total Time**: 6-10 hours
- Phase 1 (Utilities): 1-2 hours
- Phase 2 (Components): 4-6 hours
- Phase 3 (Testing): 2-3 hours

**Priority**: P2 (Nice-to-have UX improvement)
**Risk**: Low (UI-only, no breaking changes)
