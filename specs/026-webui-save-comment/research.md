# Research: Keyboard Shortcuts for Save and Comment Actions

**Phase**: 0 (Outline & Research)
**Date**: 2025-11-11
**Feature**: [spec.md](./spec.md) | [plan.md](./plan.md)

## Overview

This document consolidates research findings for implementing Cmd/Ctrl+Enter keyboard shortcuts in the Web UI. Since this is a UI-only enhancement with no backend changes, research focuses on React patterns, accessibility, browser compatibility, and testing strategies.

## Research Questions Resolved

### 1. Keyboard Event Handling in React

**Decision**: Use `onKeyDown` event handler with `e.metaKey || e.ctrlKey` check

**Rationale**:
- `onKeyDown` fires before default browser behavior, allowing `preventDefault()`
- `metaKey` detects Cmd on macOS, `ctrlKey` detects Ctrl on Windows/Linux
- React's synthetic events provide consistent cross-browser behavior
- Existing codebase pattern in `SearchInput.tsx` uses this approach successfully

**Alternatives Considered**:
- **useEffect with addEventListener**: More complex, requires cleanup, unnecessary for React components
- **onKeyPress**: Deprecated in React, not recommended for new code
- **onKeyUp**: Fires after action completes, not suitable for preventing default behavior

**Implementation Pattern**:
```tsx
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    handleSubmit(); // Call existing submit handler
  }
};

<textarea onKeyDown={handleKeyDown} />
```

### 2. OS Detection for Tooltip Display

**Decision**: Use `navigator.platform` or `navigator.userAgentData.platform` for OS detection

**Rationale**:
- Simple, reliable way to detect macOS vs Windows/Linux
- Needed to show correct tooltip (⌘+Enter vs Ctrl+Enter)
- No additional dependencies required
- Browser support excellent (99%+ of modern browsers)

**Alternatives Considered**:
- **userAgent parsing**: More complex, prone to errors, deprecated
- **CSS media queries**: Cannot be used for dynamic tooltip text
- **No detection (show both)**: Confusing for users, clutters UI

**Implementation Pattern**:
```tsx
const isMac = /Mac|iPhone|iPod|iPad/.test(navigator.platform);
const shortcutHint = isMac ? '⌘+Enter' : 'Ctrl+Enter';
```

### 3. Preventing Duplicate Submissions

**Decision**: Rely on existing form submission prevention patterns (disabled state during submission)

**Rationale**:
- All current forms already disable submit buttons during API calls
- Keyboard shortcut should trigger the same `handleSubmit()` function
- No additional logic needed - reuse existing patterns
- Consistent behavior between button click and keyboard shortcut

**Alternatives Considered**:
- **Debouncing**: Unnecessary complexity, existing patterns sufficient
- **Flag-based locking**: Already implemented in current forms via button disabled state
- **Event listener removal**: Overly complex, breaks user experience

**Implementation Note**: The keyboard handler will call the same `handleSubmit()` that the button onClick calls, inheriting all existing validation and duplicate prevention logic.

### 4. Accessibility Considerations

**Decision**: Enhance accessibility by adding `aria-keyshortcuts` attribute to form elements

**Rationale**:
- Screen readers announce available keyboard shortcuts
- WCAG 2.1 best practice for keyboard navigation
- No breaking changes to existing functionality
- Improves discoverability for assistive technology users

**Implementation Pattern**:
```tsx
<textarea
  aria-keyshortcuts="Control+Enter"
  onKeyDown={handleKeyDown}
/>
```

**Reference**: WCAG 2.1 Success Criterion 2.1.1 (Keyboard) - All functionality must be operable through keyboard

### 5. Testing Strategy

**Decision**: Use React Testing Library with `userEvent.keyboard()` for integration tests

**Rationale**:
- Existing test infrastructure already uses React Testing Library
- `userEvent.keyboard()` simulates real user keyboard interactions
- Tests both the event handler and form submission logic
- Aligns with Testing Library's "test how users interact" philosophy

**Test Cases Required**:
1. Cmd+Enter triggers Save on macOS
2. Ctrl+Enter triggers Save on Windows/Linux
3. Keyboard shortcut respects validation (doesn't submit invalid forms)
4. Keyboard shortcut shows same errors as button click
5. Keyboard shortcut disabled when form is in read-only mode
6. Duplicate prevention works with keyboard shortcut

**Implementation Pattern**:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('saves task with Cmd+Enter', async () => {
  const handleSave = vi.fn();
  render(<TaskForm onSave={handleSave} />);

  const textarea = screen.getByRole('textbox');
  await userEvent.type(textarea, 'New task');
  await userEvent.keyboard('{Meta>}{Enter}{/Meta}');

  expect(handleSave).toHaveBeenCalledTimes(1);
});
```

### 6. Component Architecture Decision

**Decision**: Create reusable `useKeyboardShortcut` custom hook

**Rationale**:
- DRY principle - 4 components need identical logic
- Easier to test in isolation
- Centralized behavior ensures consistency
- Simplifies individual component code

**Alternatives Considered**:
- **Inline handlers in each component**: Code duplication, harder to maintain
- **Higher-order component (HOC)**: Outdated React pattern, hooks are preferred
- **Context provider**: Overcomplicated for this use case

**Implementation Pattern**:
```tsx
// hooks/useKeyboardShortcut.ts
export function useKeyboardShortcut(
  callback: () => void,
  options?: { disabled?: boolean }
) {
  return (e: React.KeyboardEvent) => {
    if (options?.disabled) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      callback();
    }
  };
}

// Usage in component
const handleKeyDown = useKeyboardShortcut(handleSubmit, {
  disabled: isSubmitting
});
```

## Technology Stack Confirmation

All required technologies are already in place:

- **React 19.2.0**: Full support for keyboard event handlers
- **TypeScript 5.5.4**: Strong typing for event handlers and props
- **Vitest 1.6.0**: Testing framework with React Testing Library integration
- **@testing-library/react 16.3.0**: User interaction simulation
- **@testing-library/user-event**: Keyboard event simulation

**No new dependencies required.**

## Browser Compatibility

Target browsers (all fully support required features):

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| `onKeyDown` | ✅ All | ✅ All | ✅ All | ✅ All |
| `metaKey` | ✅ All | ✅ All | ✅ All | ✅ All |
| `ctrlKey` | ✅ All | ✅ All | ✅ All | ✅ All |
| `navigator.platform` | ✅ All | ✅ All | ✅ All | ✅ All |
| `preventDefault()` | ✅ All | ✅ All | ✅ All | ✅ All |

**Minimum Browser Versions**: None (features supported since ES5)

## Best Practices Applied

1. **Event Handler Naming**: Use `handleKeyDown` (not `onKeyDown` for handler functions)
2. **TypeScript Typing**: `React.KeyboardEvent<HTMLTextAreaElement>` for type safety
3. **Prevent Default**: Always call `e.preventDefault()` to avoid textarea newline insertion
4. **Reuse Existing Logic**: Call existing `handleSubmit()` instead of duplicating logic
5. **Accessibility**: Add `aria-keyshortcuts` and maintain focus management
6. **Testing**: Integration tests over unit tests (test user behavior, not implementation)

## Performance Considerations

**Concern**: Event handler overhead on every keystroke

**Analysis**:
- Event handlers are lightweight (~0.1ms execution time)
- Early return if not Cmd/Ctrl+Enter (99% of keystrokes)
- No re-renders triggered by keystroke (unless submission occurs)
- No performance impact expected

**Monitoring**: None required (feature too simple to cause performance issues)

## Security Considerations

**Concern**: Accidental submissions via keyboard shortcut

**Mitigation**:
- Require modifier key (Cmd/Ctrl) + Enter (not just Enter)
- Respect existing validation and disabled states
- Prevent default to avoid unintended textarea behavior
- Visual feedback (tooltips) educate users about shortcuts

**No security vulnerabilities introduced.**

## Reference Implementation

Existing codebase pattern found in `SearchInput.tsx` (lines 73-78):

```tsx
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Escape') {
    setSearchTerm('');
    if (onClear) onClear();
  }
};
```

This confirms the codebase already uses keyboard event handlers successfully. Our implementation extends this pattern with modifier key detection.

## Open Questions

**None** - All research questions resolved.

## Next Steps

Proceed to Phase 1 (Design & Contracts):
- Create `data-model.md` (minimal - no data changes)
- Create `contracts/` (minimal - no API changes)
- Create `quickstart.md` (developer guide)
- Update agent context

## References

- [React Keyboard Events Documentation](https://react.dev/reference/react-dom/components/common#keyboardevent-handler)
- [MDN KeyboardEvent Reference](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent)
- [WCAG 2.1 Keyboard Accessibility](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html)
- [Testing Library User Events](https://testing-library.com/docs/user-event/intro)
- [React Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
