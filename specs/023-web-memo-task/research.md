# Research: Web UI Memo-to-Task Promotion

**Feature**: 023-web-memo-task
**Date**: 2025-11-04
**Status**: Completed

## Overview

This document consolidates research findings for implementing the memo-to-task promotion feature in the Web UI. The research focuses on React Router navigation patterns, form pre-population strategies, and existing API integration patterns in the codebase.

## Key Decisions

### Decision 1: URL Parameter vs Route Path for Memo ID

**Decision**: Use URL query parameter `?fromMemo={id}` instead of route path parameter

**Rationale**:
- Preserves existing `/tasks/new` route without modifications
- Makes promotion optional (TaskNew can work with or without memo context)
- Cleaner separation: route represents resource, query represents optional context
- Easier to extend later (e.g., `?fromMemo=123&initialStatus=next`)

**Alternatives Considered**:
- Route path `/tasks/new/from-memo/:id`: Requires new route definition, more rigid
- Route path `/tasks/new/:id`: Ambiguous (id could mean task to clone or memo to promote)

**Implementation Pattern**:
```typescript
// In TaskNew.tsx
const [searchParams] = useSearchParams();
const fromMemoId = searchParams.get('fromMemo');

useEffect(() => {
  if (fromMemoId) {
    // Fetch memo and pre-populate form
  }
}, [fromMemoId]);
```

---

### Decision 2: Form Pre-population Strategy

**Decision**: Fetch memo data in `TaskNew` component, pass as initial props to `TaskForm`

**Rationale**:
- Maintains single responsibility: TaskNew handles data fetching, TaskForm handles UI
- TaskForm remains reusable for both create and edit modes
- Consistent with existing pattern (TaskEdit fetches task, passes to TaskForm)
- Loading state managed at page level, not form level

**Alternatives Considered**:
- Fetch memo inside TaskForm: Violates separation of concerns, makes TaskForm less reusable
- Context API for memo data: Overkill for simple parent-child data flow
- Pass memo ID to TaskForm and let it fetch: Duplicates fetching logic across components

**Implementation Pattern**:
```typescript
// TaskNew.tsx
const [memo, setMemo] = useState(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (fromMemoId) {
    async function fetchMemo() {
      setLoading(true);
      const data = await MemosService.getMemo(fromMemoId);
      setMemo(data);
      setLoading(false);
    }
    fetchMemo();
  }
}, [fromMemoId]);

// Pass to TaskForm
<TaskForm
  mode="create"
  initialBodyMd={memo?.bodyMd}
  fromMemoId={memo?.id}
/>
```

---

### Decision 3: Promote API Call Location

**Decision**: Call `MemosService.promoteMemo()` from `TaskForm.handleSubmit()` when `fromMemoId` prop is present

**Rationale**:
- Form owns the submit action, natural place for API call
- TaskNew doesn't need to know about promotion logic
- Error handling stays within form (existing error state mechanism)
- Success handling (navigation) already in TaskForm

**Alternatives Considered**:
- TaskNew handles API call: Would require callback props to TaskForm, complicates interface
- Separate PromoteForm component: Duplicate code, breaks existing TaskForm reuse pattern
- Custom hook for promotion: Adds abstraction for single-use case

**Implementation Pattern**:
```typescript
// In TaskForm
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();

  if (mode === 'create' && fromMemoId) {
    // Promotion flow
    const response = await MemosService.promoteMemo(
      fromMemoId.toString(),
      { title, status }
    );
    navigate(`/tasks/${response.id}`);
  } else if (mode === 'create') {
    // Normal create flow
    const response = await TasksService.createTask({ title, bodyMd });
    navigate(`/tasks/${response.id}`);
  }
  // ... edit mode
};
```

---

### Decision 4: Promote Button Placement in MemoDetail

**Decision**: Add "Promote to Task" button next to existing "Bookmark" button in memo detail header

**Rationale**:
- Consistent with existing action button pattern (BookmarkButton)
- High visibility in header area
- Groups related actions (bookmark, promote are both quick actions)
- Follows GitHub UI pattern (actions in header)

**Alternatives Considered**:
- Floating action button: Not used elsewhere in app, inconsistent
- Dropdown menu: Overkill for single action
- Bottom of page: Lower visibility, requires scrolling

**Implementation Pattern**:
```typescript
// In MemoDetail.tsx (via ItemDetail component)
<div className="flex items-center space-x-2">
  <button onClick={handleBookmarkToggle}>
    {isBookmarked ? '🔖' : '☆'} Bookmark
  </button>
  <Link to={`/tasks/new?fromMemo=${memo.id}`}>
    <button>⬆️ Promote to Task</button>
  </Link>
</div>
```

---

### Decision 5: Initial Status Selection in Promote Flow

**Decision**: Show status dropdown in TaskForm during create mode (including promotion)

**Rationale**:
- Current TaskForm only shows status in edit mode
- Promotion use case requires initial status selection (per spec FR-005)
- Aligns with GTD workflow (user categorizes while promoting)
- Minor UI change: status field conditional on `mode === 'edit' || fromMemoId`

**Alternatives Considered**:
- Keep status hidden in create mode: Doesn't meet requirement FR-005
- Add status after task creation: Extra step, poor UX
- Default to "open" always: Loses workflow efficiency

**Implementation Pattern**:
```typescript
// In TaskForm
{(mode === 'edit' || fromMemoId) && (
  <div>
    <label>Initial Status</label>
    <select value={status} onChange={(e) => setStatus(e.target.value)}>
      <option value="open">Open</option>
      <option value="next">Next</option>
      <option value="waiting">Waiting</option>
      <option value="scheduled">Scheduled</option>
    </select>
  </div>
)}
```

---

## Best Practices Identified

### React Router DOM 7.9.4 Patterns

**Query Parameter Access**:
- Use `useSearchParams()` hook (not deprecated `useLocation().search`)
- Always handle null case: `searchParams.get('key') ?? defaultValue`
- Parse integers: `parseInt(searchParams.get('id'), 10)` with validation

**Navigation with Query Params**:
- Use `<Link to="/path?param=value">` for declarative navigation
- Use `navigate('/path?param=value')` for imperative navigation
- Preserve other params if needed: `navigate({ pathname: '/tasks/new', search: searchParams.toString() })`

### Form State Management in React 19

**Controlled Components**:
- Always use controlled inputs with `value={state}` and `onChange`
- Initialize state from props in `useState(initialProp)`
- Use `useEffect` to update state when props change (if needed)

**Async Form Submission**:
- Wrap in try/catch with loading state
- Disable submit button during submission
- Clear errors before new submission
- Navigate on success, show error on failure

### Error Handling Patterns

**API Error Display**:
- Use existing error banner pattern in forms
- Show user-friendly messages (not raw error stack)
- Preserve form state on error (don't clear inputs)
- Provide retry mechanism (re-submit button)

**Validation**:
- Validate on submit, not on every keystroke (better UX)
- Use existing `validateTaskForm()` utility
- Show validation errors above form (red banner)

---

## Integration Points

### Existing API

**Endpoint**: `POST /api/memos/:id/promote`
- **Input**: `{ title: string, status?: 'open' | 'next' | 'waiting' | 'scheduled' }`
- **Output**: Task object `{ id, title, bodyMd, status, ... }`
- **Behavior**: Creates task, transfers metadata, deletes memo, creates derived_from link

**Service Method**: `MemosService.promoteMemo(id, requestBody)`
- Already generated from OpenAPI spec
- Returns `CancelablePromise<any>` (task object)

### Existing Components

**TaskForm**:
- Props: `mode`, `initialTitle`, `initialBodyMd`, `initialStatus`, `taskId`
- Handles: create/edit logic, validation, error display, loading state
- Navigation: redirects to task detail on success

**MemoDetail**:
- Uses `ItemDetail` generic component
- Passes memo object, callbacks for delete/bookmark
- Can extend with custom action buttons

### Existing Utilities

**Validation**: `validateTaskForm(title, bodyMd, status)`
- Returns `{ isValid: boolean, errors: Record<string, string> }`
- Already handles task-specific validation rules

---

## Performance Considerations

### Data Fetching

**Memo Pre-fetch**:
- Single API call: `GET /api/memos/:id`
- Response size: ~1-5KB (typical memo with metadata)
- Cached by browser (React Query not currently used)

**Promotion API Call**:
- Single API call: `POST /api/memos/:id/promote`
- Server-side operations: task creation, metadata transfer, memo deletion
- Expected latency: <500ms (local SQLite operations)

### UI Responsiveness

**Navigation**:
- React Router navigation: instant (client-side)
- Query param parsing: synchronous, <1ms
- Form mount: <50ms

**Form Rendering**:
- Pre-populated fields: no additional delay (just prop passing)
- Status dropdown: conditional render, negligible impact

---

## Testing Strategy

### Unit Tests (Vitest)

**TaskForm Component**:
- Test prop variations: create mode with/without fromMemoId
- Test promotion flow: verify promoteMemo() called with correct args
- Test error handling: verify error banner shown on API failure

**TaskNew Component**:
- Test query param parsing: extract fromMemo correctly
- Test memo fetching: verify loading state, error state, success state
- Test prop passing: verify TaskForm receives correct initial values

### Integration Tests (API)

**Promote Endpoint**:
- Test metadata transfer: labels, links, comments, projects, bookmarks
- Test memo deletion: verify original memo removed after promotion
- Test derived_from link: verify link created correctly

### E2E Tests (Playwright)

**Full Promotion Flow**:
1. Create memo with metadata
2. Navigate to memo detail
3. Click "Promote to Task"
4. Verify task form pre-populated
5. Fill title, select status
6. Submit form
7. Verify task created with all metadata
8. Verify memo deleted
9. Verify navigation to task detail

---

## Security & Data Integrity

### Input Validation

**Client-side**:
- Task title: required, non-empty, max 255 chars (existing validation)
- Status: enum validation (existing validation)
- Memo ID: parsed integer, positive number

**Server-side**:
- Zod schema validation (PromoteMemoRequestSchema)
- Memo existence check before promotion
- Transaction-based metadata transfer (atomic operation)

### Error Recovery

**Partial Failure Handling**:
- If promotion fails, memo must NOT be deleted (API already handles this)
- Client displays error, allows retry
- No orphaned data (all-or-nothing transaction)

**Concurrent Edit Prevention**:
- Not addressed in current implementation (accepted limitation)
- Edge case documented in spec

---

## Dependencies

### External Packages

- `react-router-dom@7.9.4`: Query param handling, navigation
- `react@19.2.0`: Hooks (useEffect, useState), form handling
- Existing API client: Generated from OpenAPI spec

### Internal Packages

- `meme-gtd-shared`: Shared types (TaskStatus enum)
- `packages/api`: Promotion endpoint
- `packages/core`: MemoService.promote()
- `packages/db`: promoteMemo() database operations

---

## Open Questions & Assumptions

### Assumptions

1. **Memo always has bodyMd**: Empty body is valid (edge case documented)
2. **API endpoint is stable**: No breaking changes expected
3. **Single-user application**: No concurrent edit handling needed
4. **Browser support**: Modern browsers with ES2020+ support
5. **No offline mode**: Network required for promotion

### Resolved Questions

- ✅ Which navigation pattern? → URL query parameter
- ✅ Where to call promote API? → TaskForm.handleSubmit()
- ✅ Show status dropdown? → Yes, conditionally
- ✅ Button placement? → Header next to bookmark

### Future Enhancements (Out of Scope)

- Undo promotion (requires memo restoration)
- Bulk promotion (multiple memos at once)
- Promotion from memo list view
- Customizable metadata transfer (select which to preserve)

---

## References

- Feature Spec: `specs/023-web-memo-task/spec.md`
- API Documentation: `packages/api/docs/api/openapi.yaml`
- React Router Docs: https://reactrouter.com/en/main/hooks/use-search-params
- Existing Patterns: `packages/web/src/pages/TaskEdit.tsx` (edit flow reference)
