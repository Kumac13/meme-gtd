# Link Management Web Interface - Implementation Research

**Date**: 2025-10-24
**Feature**: Link Management Web UI (Issue #43)
**Target**: React/TypeScript Web UI in packages/web

---

## 1. Component Integration Pattern (RT-001)

### Decision
**Use self-contained component with its own API calls** (CommentSection pattern)

### Rationale
The CommentSection component (lines 1-129 in CommentSection.tsx) demonstrates the ideal pattern for this feature:
- Manages its own state independently (loading, comments list, form state)
- Makes direct API calls via service methods
- Handles all lifecycle within the component
- Parent component (ItemDetail) only needs to pass itemId and itemType props
- Allows the Links section to be easily added/removed without complex state lifting

This pattern is superior to managing state in ItemDetail because:
1. Links are a distinct feature with their own CRUD operations
2. Reduces prop drilling and keeps ItemDetail clean
3. Makes the component reusable and testable in isolation
4. Follows the existing architecture established by CommentSection

### Code Example
```tsx
// LinkSection.tsx (new component)
import { useState, useEffect } from 'react';
import { LinksService } from '../api/services/LinksService';

interface LinkSectionProps {
  itemId: number;
  itemType: 'memo' | 'task';
}

export default function LinkSection({ itemId, itemType }: LinkSectionProps) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const response = await LinksService.listIssueLinks(String(itemId));
      setLinks(response);
    } catch (error) {
      console.error('Error fetching links:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [itemId]);

  // ... rest of component logic
}

// Integration in ItemDetail.tsx (lines 150-151)
{/* Links section */}
<LinkSection itemId={item.id} itemType={itemType} />
```

### Alternatives Considered
- **State managed in ItemDetail**: Rejected because it would require lifting state, adding multiple callback props, and cluttering the parent component. This approach would also break the encapsulation demonstrated by Labels (inline display) and Comments (self-contained).
- **Hybrid approach with shared state**: Rejected for unnecessary complexity. The Links feature is independent enough to manage its own state.

---

## 2. API Client Usage (RT-002)

### Decision
**Use LinksService methods directly with String ID conversion and standard error handling**

### Rationale
The existing LinksService.ts (lines 8-134) follows the auto-generated openapi-typescript-codegen pattern used throughout the codebase:
- Service methods are static and return CancelablePromise
- IDs are passed as strings (e.g., `listIssueLinks(id: string)`)
- Standard HTTP methods (GET, POST, DELETE) are wrapped cleanly
- Error handling via try/catch with console.error logging matches the pattern in CommentSection (lines 32-33, 55-56)

The enhanced API response (from Issue #43 update) now includes targetIssue information, eliminating the need for additional API calls to fetch issue titles.

### Code Example
```tsx
// Fetching links
const fetchLinks = async () => {
  try {
    setLoading(true);
    const response = await LinksService.listIssueLinks(String(itemId));
    setLinks(response);
  } catch (error) {
    console.error('Error fetching links:', error);
    // Optional: Set error state for user-facing message
  } finally {
    setLoading(false);
  }
};

// Creating a link
const handleAddLink = async (targetId: number, linkType: string) => {
  try {
    setSubmitting(true);
    await LinksService.createLink({
      sourceIssueId: itemId,
      targetIssueId: targetId,
      linkType: linkType as 'parent' | 'child' | 'relates' | 'derived_from',
    });
    await fetchLinks(); // Refresh the list
    setIsAdding(false);
  } catch (error) {
    console.error('Error creating link:', error);
    setErrorMessage('Failed to create link. Please try again.');
  } finally {
    setSubmitting(false);
  }
};

// Deleting a link
const handleDeleteLink = async (linkId: number) => {
  try {
    await LinksService.deleteLink(String(linkId));
    setLinks(links.filter((l) => l.id !== linkId));
  } catch (error) {
    console.error('Error deleting link:', error);
  }
};
```

### Alternatives Considered
- **Custom API wrapper**: Rejected because it would add unnecessary abstraction. The generated service is type-safe and consistent.
- **Number ID parameters**: Rejected because the OpenAPI spec defines IDs as strings with pattern validation (`^\d+$`). Converting to String is the established pattern.

---

## 3. Icon Rendering Approach (RT-003)

### Decision
**Use inline SVG icons (not emoji) for consistency and accessibility**

### Rationale
The existing codebase (ItemDetail.tsx lines 109-116) demonstrates consistent use of inline SVG icons:
- Bookmark icon uses `<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">`
- Allows proper styling via CSS classes (size, color, hover states)
- Screen-reader friendly with proper ARIA labels
- Consistent with GitHub's design system (16x16 viewBox)
- Avoids emoji rendering inconsistencies across platforms

Using emoji (📤/📥/🔗/⚡) would introduce:
- Platform-dependent rendering variations
- Accessibility issues (emoji are not properly described to screen readers)
- Inconsistent sizing and alignment
- Difficulty applying hover states and color changes

### Code Example
```tsx
// Icon components (create shared icons.tsx file)
const IconParent = ({ direction }: { direction: 'outgoing' | 'incoming' }) => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
    {direction === 'outgoing' ? (
      <path d="M8 0a.75.75 0 0 1 .75.75v7.19l2.72-2.72a.75.75 0 1 1 1.06 1.06L8.53 10.28a.75.75 0 0 1-1.06 0L3.47 6.28a.75.75 0 0 1 1.06-1.06l2.72 2.72V.75A.75.75 0 0 1 8 0Z" />
    ) : (
      <path d="M7.47 1.22a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1-1.06 1.06L8.75 3.56v7.19a.75.75 0 0 1-1.5 0V3.56L4.53 6.28a.75.75 0 0 1-1.06-1.06l4-4Z" />
    )}
  </svg>
);

const IconRelated = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
    <path d="M4.5 3.5a2.5 2.5 0 0 1 5 0 .75.75 0 0 0 1.5 0 4 4 0 0 0-8 0v.975a6.5 6.5 0 0 0 0 7.05V12.5a2.5 2.5 0 0 1 5 0 .75.75 0 0 0 1.5 0 4 4 0 0 0-8 0v-.975a6.5 6.5 0 0 0 0-7.05V3.5Z" />
  </svg>
);

// Usage in component
<div className="flex items-center gap-2">
  <IconParent direction={link.direction} />
  <span className="text-sm text-gray-700">
    {getLinkLabel(link.linkType, link.direction)}
  </span>
</div>
```

### Alternatives Considered
- **Emoji directly in JSX**: Rejected for accessibility and cross-platform consistency issues
- **Icon library (FontAwesome, Heroicons)**: Rejected to avoid adding dependencies. Inline SVG matches the existing pattern and keeps bundle size minimal.

---

## 4. Collapsible UI Implementation (RT-004)

### Decision
**Use custom React state (useState hook) for collapse/expand functionality**

### Rationale
After searching the codebase, no existing collapsible patterns were found (no `<details>` elements, no collapse components). The codebase uses simple React state management patterns:
- EditableContent.tsx uses `useState(false)` for menu toggle (line 28)
- CommentSection manages form visibility with state

Using `useState` provides:
- Full control over collapse state and animation
- Consistent with existing codebase patterns
- Easy integration with link count updates
- Ability to default to expanded state when links exist

Native `<details>` element was considered but rejected because:
- Limited styling flexibility (especially for custom animations)
- Difficult to control default open/closed state programmatically
- Harder to sync with link count in header
- Less consistent with React-driven UI patterns in the codebase

### Code Example
```tsx
interface LinkSectionProps {
  itemId: number;
  itemType: 'memo' | 'task';
}

export default function LinkSection({ itemId, itemType }: LinkSectionProps) {
  const [links, setLinks] = useState<Link[]>([]);
  const [isExpanded, setIsExpanded] = useState(true); // Default expanded
  const [loading, setLoading] = useState(true);

  // ... fetch logic

  return (
    <div className="border-b border-gray-200 pb-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-gray-700"
        >
          <svg
            className={`w-3 h-3 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
          </svg>
          Links ({links.length})
        </button>
        {!loading && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-sm text-github-green-600 hover:text-github-green-700"
          >
            + Add
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-gray-500">Loading links...</p>
          ) : links.length === 0 ? (
            <p className="text-sm text-gray-500">No links yet</p>
          ) : (
            links.map((link) => (
              <LinkItem
                key={link.id}
                link={link}
                onDelete={handleDeleteLink}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

### Alternatives Considered
- **Native `<details>` element**: Rejected due to limited styling control and inconsistency with React patterns
- **Third-party collapse library**: Rejected to avoid dependencies. Simple useState is sufficient.
- **CSS-only accordion**: Rejected because JavaScript state is needed for dynamic link count and integration with add/delete operations.

---

## 5. Inline Form Flow (RT-005)

### Decision
**Multi-step inline flow: [+ Add] → Select type → Enter ID → [Add] button**

### Rationale
The GitHub issue #43 UI mockup shows a clear three-step flow:
1. Click [+ Add] button
2. Select link type from dropdown (parent/child/relates/derived_from)
3. Show input field for target issue ID with [Add] and [Cancel] buttons

This pattern provides:
- Progressive disclosure (only show input after type is selected)
- Clear user intent before requiring input
- Matches GitHub's sub-issues UX referenced in the issue
- Validation opportunity at each step
- Easy cancellation without clutter

The existing CommentSection (lines 107-125) demonstrates inline form patterns:
- Form appears directly in the content area
- Submit and cancel actions are clearly visible
- Uses standard Tailwind button styling

### Code Example
```tsx
export default function LinkSection({ itemId, itemType }: LinkSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [targetId, setTargetId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleCancelAdd = () => {
    setIsAdding(false);
    setSelectedType(null);
    setTargetId('');
    setErrorMessage('');
  };

  const handleSubmitAdd = async () => {
    if (!targetId.trim() || !selectedType) return;

    try {
      setSubmitting(true);
      setErrorMessage('');
      await LinksService.createLink({
        sourceIssueId: itemId,
        targetIssueId: parseInt(targetId, 10),
        linkType: selectedType as 'parent' | 'child' | 'relates' | 'derived_from',
      });
      await fetchLinks();
      handleCancelAdd();
    } catch (error: any) {
      console.error('Error creating link:', error);
      // Parse API error message
      setErrorMessage(
        error?.body?.message || 'Failed to create link. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* ... header and existing links ... */}

      {isAdding && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2">
          {!selectedType ? (
            // Step 1: Select link type
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Select link type:
              </p>
              <div className="space-y-1">
                {['parent', 'child', 'relates', 'derived_from'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  >
                    Create {type} link
                  </button>
                ))}
              </div>
              <button
                onClick={handleCancelAdd}
                className="mt-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            // Step 2: Enter target issue ID
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Adding {selectedType} link
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="Enter issue ID (e.g., 5)"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500"
                  disabled={submitting}
                />
                <button
                  onClick={handleSubmitAdd}
                  disabled={submitting || !targetId.trim()}
                  className="px-4 py-2 text-sm bg-github-green-600 text-white rounded-md hover:bg-github-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Adding...' : 'Add'}
                </button>
                <button
                  onClick={handleCancelAdd}
                  disabled={submitting}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              {errorMessage && (
                <p className="mt-2 text-sm text-red-600">⚠️ {errorMessage}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Alternatives Considered
- **Single-step form (all fields visible)**: Rejected because it clutters the UI and doesn't guide the user through the flow. Type selection is a critical decision point.
- **Modal dialog**: Rejected per issue #43 "Out of Scope" section. Inline forms match the existing Web UI patterns (see CommentSection).
- **Autocomplete search for target issue**: Deferred for future enhancement. The current scope focuses on direct ID input as specified in the issue mockup.

---

## Summary of Decisions

| Research Topic | Decision | Key Justification |
|----------------|----------|-------------------|
| **RT-001: Component Structure** | Self-contained component with own API calls | Matches CommentSection pattern, maintains encapsulation |
| **RT-002: API Client Integration** | Use LinksService directly with String IDs | Follows existing codegen pattern, type-safe |
| **RT-003: Icon Display** | Inline SVG icons | Accessibility, consistency with existing UI (bookmark icon) |
| **RT-004: Collapsible Section** | Custom React state (useState) | No existing collapse patterns found, flexible control |
| **RT-005: Inline Form Flow** | Multi-step: Add → Type → ID → Submit | Matches GitHub UX, progressive disclosure, clear intent |

---

## Next Steps

1. Implement `LinkSection.tsx` component following CommentSection structure
2. Create icon components for link types (parent/child/relates/derived_from)
3. Integrate into ItemDetail.tsx between Labels and Body sections (line 150)
4. Add error handling for API validation (circular links, duplicates)
5. Add loading states and empty states
6. Write component tests

## References

- **CommentSection.tsx**: Primary pattern reference for self-contained components
- **ItemDetail.tsx**: Integration point (lines 120-135 Labels section, line 150 integration point)
- **LinksService.ts**: API client methods (lines 8-134)
- **EditableContent.tsx**: State management patterns (lines 24-28)
- **GitHub Issue #43**: UI mockups and requirements
- **OpenAPI spec**: Link endpoints documentation (lines 3067-3393)
