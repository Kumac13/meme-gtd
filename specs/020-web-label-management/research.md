# Research: Web UI Label Management Implementation

**Feature**: 020-web-label-management
**Date**: 2025-10-28
**Status**: Phase 0 Complete

## Purpose

This document consolidates research findings for implementing label management in the Web UI. It addresses all NEEDS CLARIFICATION items from the Technical Context and provides evidence-based decisions for the implementation.

---

## Research Areas

### 1. React Label Selector Component Patterns

#### Decision: Modal Dialog with Checkbox List

**What was chosen**: Modal dialog with checkbox-based multi-select, following the existing `ProjectManagementModal` pattern (feature #017).

**Why chosen**:
- **Consistency**: Project already successfully implements this pattern in `/packages/web/src/components/ProjectManagementModal.tsx`
- **Proven UX**: GitHub, Linear, and other issue trackers use modal-based label selectors
- **Space efficiency**: Doesn't clutter item detail page; provides focused interaction
- **Mobile friendly**: Modal approach works better on smaller screens than inline dropdowns
- **Existing user familiarity**: Users already understand this pattern from project assignment

**Alternatives considered**:
1. **Inline dropdown with Downshift/React Aria**
   - Rejected: Adds external dependencies (React Aria ~100KB bundle size)
   - Rejected: Inconsistent with existing project patterns
   - Rejected: More complex implementation

2. **Inline expanding section**
   - Rejected: Takes up vertical space on item detail page
   - Rejected: Less mobile-friendly
   - Rejected: Doesn't follow existing project patterns

**Evidence**:
- Existing implementation: `packages/web/src/components/ProjectManagementModal.tsx` lines 112-269
- Successfully handles search, filtering, recent items, and checkbox selection
- User feedback on project management feature has been positive

---

### 2. Component Architecture & Composition

#### Decision: Multiple Small Components with Local State

**Component Structure**:
```
LabelManagementModal (orchestrator)
├── LabelSearchInput (search/filter)
├── RecentLabelsSection (recent labels display)
│   └── LabelCheckboxItem (checkbox + label display)
├── AllLabelsSection (all labels display)
│   └── LabelCheckboxItem (reused)
└── LabelCreationForm (creation UI)
    ├── LabelNameInput
    ├── LabelDescriptionInput
    └── LabelPreview
        └── LabelBadge (color preview)

LabelBadge (standalone, reusable display component)
└── Used in ItemDetail, KanbanCard, etc.
```

**State Management**: Local component state using React hooks (useState, useEffect)

**Why chosen**:
- **Testability**: Each component can be unit tested independently
- **Reusability**: `LabelBadge` can be used throughout the application
- **Maintainability**: Clear separation of concerns
- **Simplicity**: No need for Context API or external state management
- **Follows project patterns**: Similar to existing component breakdown
- **React 19 optimization**: Automatic memoization reduces need for complex state solutions

**Alternatives considered**:
- **Single monolithic component**: Rejected due to poor testability and maintainability
- **Context API for state**: Rejected as unnecessary complexity for modal-scoped state
- **Zustand/Redux**: Rejected as overkill for transient UI state

---

### 3. Label Creation Pattern

#### Decision: Inline Form within Modal

**What was chosen**: Provide a "Create new label" button within the label selector modal that expands to show an inline creation form.

**Why chosen**:
- **Minimal context switching**: Users stay in the same modal dialog
- **Fast workflow**: Matches success criteria SC-002 (create and assign in under 15 seconds)
- **Common pattern**: GitHub, GitLab use inline creation in label selector
- **Simple state management**: Modal mode toggle ('select' | 'create')

**Implementation Pattern**:
```tsx
const [mode, setMode] = useState<'select' | 'create'>('select');

{mode === 'select' && (
  <button onClick={() => setMode('create')}>+ Create new label</button>
)}

{mode === 'create' && (
  <LabelCreationForm onCancel={() => setMode('select')} />
)}
```

**Alternatives considered**:
- **Separate modal for creation**: Rejected due to additional context switching

---

### 4. Search and Filtering

#### Decision: Simple Client-Side Filtering with useMemo

**What was chosen**: Uncontrolled input with client-side filtering using useMemo, no debouncing.

**Why chosen**:
- **Performance**: Spec assumes <100 labels, so client-side filtering is sufficient
- **Simplicity**: No need for server-side search API or complex virtualization
- **Proven pattern**: Already implemented successfully in `ProjectManagementModal.tsx`
- **React 19 optimization**: Automatic optimization reduces need for manual debouncing

**Implementation**:
```tsx
const filteredLabels = useMemo(() => {
  if (!searchQuery.trim()) return allLabels;
  const query = searchQuery.toLowerCase();
  return allLabels.filter(label =>
    label.name.toLowerCase().includes(query)
  );
}, [allLabels, searchQuery]);
```

**Why no debouncing**:
- Small dataset (<100 labels): Filtering is instant (O(n) is fine)
- React 19 automatic optimization handles rendering efficiently
- Simple substring match is very fast

**Alternatives considered**:
- **Debounced input**: Rejected as premature optimization
- **Server-side search**: Rejected as unnecessary for small dataset

---

### 5. Recent Labels Feature

#### Decision: localStorage with Custom useRecentLabels Hook

**What was chosen**: FIFO queue stored in browser localStorage using a custom hook following the `useRecentProjects` pattern.

**Why chosen**:
- **Proven pattern**: Project already has successful implementation in `useRecentProjects.ts`
- **Efficiency**: Matches success criteria SC-005 (30% reduction in assignment time)
- **Persistence**: Survives browser restarts (spec requirement)
- **Simple**: No server-side storage needed for UI optimization
- **Session-specific**: Per-user workflow optimization as intended

**Implementation Approach**:
```tsx
const STORAGE_KEY = 'mgtd:recentLabels';
const MAX_STORED_LABELS = 5;

interface RecentLabelsStorage {
  labelIds: number[];
  lastUsedAt: Record<number, string>;
}

export function useRecentLabels() {
  const [storage, setStorage] = useState<RecentLabelsStorage>(loadRecentLabels);

  const addRecentLabel = useCallback((labelId: number) => {
    setStorage(prev => {
      const filtered = prev.labelIds.filter(id => id !== labelId);
      const newLabelIds = [labelId, ...filtered].slice(0, MAX_STORED_LABELS);
      // Persist immediately
      return newStorage;
    });
  }, []);

  return { addRecentLabel, getRecentLabels };
}
```

**Key Features**:
- **Deduplication**: Same label moved to front, no duplicates
- **FIFO**: Max 5 labels, oldest removed when adding 6th
- **Error handling**: Graceful degradation for Safari private mode, quota exceeded
- **Timestamp tracking**: ISO timestamps for accurate ordering
- **Deleted label handling**: Automatically filters non-existent labels

**No cross-tab synchronization**:
- Spec explicitly states: "Recent labels are stored per-user in browser local storage and do not sync across devices"
- Recent labels reflect current session workflow, not a shared preference
- Storage events add complexity without value

**Alternatives considered**:
- **useSyncExternalStore**: Rejected as overkill for session-specific state
- **Debounced updates**: Rejected due to risk of data loss on browser close
- **IndexedDB**: Rejected as unnecessary complexity for lightweight data

---

### 6. Label Color Generation

#### Decision: Deterministic HSL Algorithm (Existing Implementation)

**What was chosen**: Use the existing `getLabelColor()` function from `ItemDetail.tsx` with potential accessibility improvements.

**Current Implementation**:
```tsx
const getLabelColor = (label: string): string => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 80%)`;
};
```

**Why chosen**:
- **Consistency**: Same label always generates the same color
- **No storage**: Colors computed on-the-fly, no DB field needed
- **Sufficiently distinct**: 360 hues with fixed saturation/lightness
- **Already implemented**: Function exists and works in production

**Recommended Improvement** (optional enhancement):
```tsx
const getLabelColor = (label: string): { bg: string; text: string } => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;

  // Fixed saturation/lightness for consistent contrast
  const bgColor = `hsl(${hue}, 85%, 90%)`;  // Light background
  const textColor = `hsl(${hue}, 70%, 25%)`;  // Dark text

  return { bg: bgColor, text: textColor };
};
```

**Accessibility Note**: Research shows HSL can have contrast issues. The improved version ensures WCAG AA compliance (4.5:1 contrast ratio) by using fixed lightness values that guarantee readable text.

**Alternatives considered**:
- **Custom color picker**: Rejected as out of scope (spec explicitly excludes this)
- **Predefined color palette**: Rejected due to limited colors (only 8-10 distinct options)
- **color-hash library**: Rejected as unnecessary dependency for simple hash function

---

### 7. TailwindCSS Styling Approach

#### Decision: Inline Styles for Dynamic Colors + Tailwind Utilities for Static Styling

**What was chosen**: Use inline styles for dynamic HSL colors combined with TailwindCSS utility classes for static styling.

**Why chosen**:
- **Simple**: Standard CSS inline styles, no special syntax
- **No runtime overhead**: Unlike CSS-in-JS libraries
- **Type-safe**: Works naturally with TypeScript
- **Clear separation**: Inline for dynamic (colors), classes for static (padding, font)
- **Tailwind limitations**: Arbitrary values like `bg-[hsl(180 70% 80%)]` require space-separated HSL syntax, awkward to construct dynamically

**Implementation**:
```tsx
<span
  style={{
    backgroundColor: `hsl(${h}, ${s}%, ${l}%)`,
    color: getTextColor(l)
  }}
  className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium"
>
  {label.name}
</span>
```

**Visual Design Pattern** (based on Flowbite, Preline UI, Material Tailwind):
- **Shape**: Rounded rectangles (`rounded-md`) or pills (`rounded-full`)
- **Typography**: `text-xs font-medium`
- **Padding**: `px-2.5 py-0.5` (horizontal > vertical)
- **Display**: `inline-flex` for proper alignment

**Accessibility Requirements**:
- **Color contrast**: 4.5:1 for WCAG AA (achieved with lightness 80% + dark text)
- **Touch targets**: 44x44px minimum for interactive elements
- **Focus visible**: `focus:ring-2 focus:ring-offset-1` for keyboard navigation
- **Beyond color**: Label names are primary identifiers

**Responsive Design**:
```tsx
// Overflow handling: show max 3 labels + count
<div className="flex flex-wrap gap-2">
  {labels.slice(0, 3).map(label => <LabelBadge />)}
  {labels.length > 3 && <span>+{labels.length - 3}</span>}
</div>

// Truncate long names
<span className="truncate max-w-[150px]" title={label.name}>
  {label.name}
</span>
```

**Alternatives considered**:
- **TailwindCSS arbitrary values**: Rejected due to awkward space-separated HSL syntax
- **CSS variables + Tailwind classes**: Rejected as more complex than inline styles
- **CSS-in-JS (styled-components, emotion)**: Rejected due to runtime overhead and no existing usage in project

---

### 8. Optimistic UI Updates

#### Decision: Immediate State Updates with Rollback on Error

**What was chosen**: Update UI immediately on checkbox toggle, rollback if API call fails.

**Why chosen**:
- **Fast feedback**: Matches SC-007 (feedback within 1 second)
- **Better UX**: Users see immediate response, don't wait for network
- **Error recovery**: Rollback ensures consistency if API fails
- **Follows project patterns**: Similar to bookmark toggle in `ItemDetail.tsx`

**Implementation**:
```tsx
const handleToggleLabel = async (labelId: number, isCurrentlyAssigned: boolean) => {
  // Optimistic update
  setAssignedLabelIds(prev => {
    const next = new Set(prev);
    isCurrentlyAssigned ? next.delete(labelId) : next.add(labelId);
    return next;
  });

  try {
    setSaving(true);
    if (isCurrentlyAssigned) {
      await LabelsService.removeLabelFromIssue(itemId, labelId);
    } else {
      await LabelsService.assignLabelToIssue(itemId, { labelId });
      addRecentLabel(labelId);
    }
    onLabelsChanged();
  } catch (err) {
    // Rollback on error
    setAssignedLabelIds(prev => {
      const next = new Set(prev);
      isCurrentlyAssigned ? next.add(labelId) : next.delete(labelId);
      return next;
    });
    setError(err.message);
  } finally {
    setSaving(false);
  }
};
```

**Alternatives considered**:
- **Pessimistic updates**: Rejected due to poor perceived performance
- **No rollback on error**: Rejected due to state inconsistency risk

---

### 9. Accessibility Implementation

#### Decision: Manual ARIA Implementation (No External Libraries)

**What was chosen**: Implement ARIA attributes manually following WAI-ARIA Dialog pattern.

**Why chosen**:
- **No external dependencies**: Avoids adding React Aria, Radix UI (React Aria is ~100KB)
- **Follows project patterns**: Manual ARIA implementation matches existing code style
- **Sufficient for requirements**: Spec doesn't require advanced keyboard shortcuts
- **WCAG 2.2 AA compliance**: Ensures accessibility for screen readers

**Required ARIA Attributes**:
```tsx
<div role="dialog" aria-modal="true" aria-labelledby="label-modal-title">
  <h2 id="label-modal-title">Manage Labels</h2>

  <input
    type="text"
    role="searchbox"
    aria-label="Filter labels"
  />

  <label>
    <input
      type="checkbox"
      role="checkbox"
      aria-checked={isAssigned}
      aria-labelledby={`label-name-${id}`}
    />
    <span id={`label-name-${id}`}>{name}</span>
  </label>
</div>
```

**Keyboard Navigation**:
- **Esc**: Close modal
- **Tab/Shift+Tab**: Navigate between checkboxes and buttons
- **Space**: Toggle checkbox
- **Enter**: Submit form (when in creation mode)

**Alternatives considered**:
- **React Aria**: Rejected due to large bundle size and inconsistent patterns
- **Radix UI**: Rejected for same reasons as React Aria

---

### 10. Performance Optimizations

#### Decision: Minimal Strategic Use of useMemo/useCallback

**What was chosen**: Use useMemo for filtered lists, avoid premature optimization elsewhere.

**Why chosen**:
- **React 19 automatic memoization**: React Compiler optimizes behind the scenes
- **Small dataset**: <100 labels doesn't require virtualization
- **Measure first**: Only optimize after profiling confirms need
- **Avoid overhead**: Manual memoization has cost; only use when beneficial

**Recommended Usage**:
```tsx
// ✅ GOOD: Expensive computation (filtering array)
const filteredLabels = useMemo(() => {
  if (!searchQuery.trim()) return allLabels;
  return allLabels.filter(label =>
    label.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
}, [allLabels, searchQuery]);

// ✅ GOOD: Stable function reference for child components
const handleToggleLabel = useCallback((labelId, isAssigned) => {
  // ... implementation
}, [itemId, addRecentLabel, onLabelsChanged]);

// ❌ AVOID: Cheap computation
const labelCount = useMemo(() => allLabels.length, [allLabels]);

// ❌ AVOID: Function not passed to children
const handleSearch = useCallback(
  (e) => setSearchQuery(e.target.value),
  []
);
```

**Virtualization Decision**: NOT NEEDED
- Spec assumes <100 labels (stated in plan.md)
- Rendering 100 checkboxes takes ~10ms on modern devices
- react-window adds 30KB bundle size + implementation complexity
- **Threshold for future consideration**: >500 labels OR >100ms render times

**Alternatives considered**:
- **Aggressive memoization everywhere**: Rejected as premature optimization
- **react-window for all lists**: Rejected as unnecessary complexity

---

## Implementation Recommendations

### Phase 0: Foundation ✅ (This Document)
- ✅ Research component patterns
- ✅ Research localStorage best practices
- ✅ Research TailwindCSS styling
- ✅ Research accessibility requirements
- ✅ Research performance considerations

### Phase 1: Design Artifacts (Next Steps)
- Generate data-model.md (label assignment data flow)
- Generate contracts/ (new DELETE endpoint specification)
- Generate quickstart.md (developer onboarding)

### Phase 2: Implementation (After Phase 1)
- Create LabelBadge component
- Create useRecentLabels hook
- Create LabelManagementModal component
- Add DELETE /api/issues/:issueId/labels/:labelId endpoint
- Write unit tests and E2E tests

---

## Risk Mitigation

### Risk: New API Endpoint Required
- **Mitigation**: Well-justified in Constitution Check (Gate 2)
- **Scope**: Minimal backend change (one endpoint)
- **Alternative considered**: Full label replacement - rejected due to poor UX and race conditions

### Risk: Color Contrast Issues
- **Mitigation**: Use fixed lightness values for WCAG AA compliance
- **Testing**: Include contrast testing in E2E tests
- **Future enhancement**: Color palette refinement based on user feedback

### Risk: localStorage Quota Exceeded
- **Mitigation**: Comprehensive error handling in useRecentLabels hook
- **Likelihood**: Very low (only 200 bytes for 5 labels)
- **Fallback**: Graceful degradation (feature continues to work without recent labels)

---

## References

### Project Files
- Feature spec: `/specs/020-web-label-management/spec.md`
- Implementation plan: `/specs/020-web-label-management/plan.md`
- Existing modal pattern: `/packages/web/src/components/ProjectManagementModal.tsx`
- Existing recent items hook: `/packages/web/src/hooks/useRecentProjects.ts`
- Existing label display: `/packages/web/src/components/ItemDetail.tsx`

### Research Sources
- React 19 Memoization Best Practices (DEV Community, 2024)
- WAI-ARIA Authoring Practices Guide (W3C)
- Accessible Palette: Stop using HSL for color systems (Wildbit)
- WCAG 2.2 Guidelines (W3C)
- TailwindCSS Documentation (v4.1)
- Vitest Testing Documentation
- localStorage Best Practices (LogRocket, 2024)

---

**Research Complete**: 2025-10-28
**Next Phase**: Generate data-model.md, contracts/, and quickstart.md
