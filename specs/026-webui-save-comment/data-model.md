# Data Model: Keyboard Shortcuts for Save and Comment Actions

**Phase**: 1 (Design & Contracts)
**Date**: 2025-11-11
**Feature**: [spec.md](./spec.md) | [plan.md](./plan.md) | [research.md](./research.md)

## Overview

This feature is a **UI-only enhancement** with no data model changes. No database tables, API endpoints, or backend logic are modified. This document exists for completeness but contains minimal content.

## Data Model Changes

**Status**: ❌ NOT APPLICABLE

This feature does not introduce or modify any data entities, database tables, or persistent storage.

## Entities

**Status**: ❌ NOT APPLICABLE

No new entities are created. The feature operates entirely on existing UI state:

- **Forms**: TaskForm, MemoForm, ProjectForm, EditableContent (already exist)
- **Comments**: CommentSection (already exists)
- **User Input**: Keyboard events (ephemeral, not persisted)

## State Management

### Component-Level State (React)

The feature uses existing component state. No new state is required:

**TaskForm.tsx**:
- `title`, `body`, `projectId`, `labels` (existing)
- `isSubmitting` (existing - prevents duplicate submissions)

**MemoForm.tsx**:
- `body` (existing)
- `isSubmitting` (existing)

**CommentSection.tsx**:
- `newCommentBody` (existing)
- `isSubmitting` (existing)

**EditableContent.tsx**:
- `editedValue` (existing)
- `isEditing` (existing)

### UI State (New - Minimal)

Only new state is for OS detection (computed once, not reactive):

```tsx
// Computed in utility function, not stored in state
const isMac = /Mac|iPhone|iPod|iPad/.test(navigator.platform);
```

This is a **static computation**, not reactive state. It determines tooltip text only.

## Validation Rules

**Status**: ♻️ REUSED FROM EXISTING FORMS

The keyboard shortcut triggers the same validation as clicking the Save/Comment button:

**TaskForm Validation** (existing, reused):
- Title: Required, min 1 character
- Body: Optional
- ProjectId: Optional, must be valid UUID if provided

**MemoForm Validation** (existing, reused):
- Body: Required, min 1 character

**CommentSection Validation** (existing, reused):
- Comment body: Required, min 1 character

**EditableContent Validation** (existing, reused):
- Edited value: Required, min 1 character
- Must be different from original value

## State Transitions

**Status**: ♻️ REUSED FROM EXISTING FORMS

State transitions remain unchanged. The keyboard shortcut participates in existing transitions:

### Save Action Transition

```
[Editing] → (Cmd/Ctrl+Enter OR Click Save) → [Validating] → [Submitting] → [Success/Error]
                    ↓
              Same handler
```

### Comment Action Transition

```
[Typing] → (Cmd/Ctrl+Enter OR Click Comment) → [Validating] → [Submitting] → [Success] → [Cleared]
                    ↓
              Same handler
```

**Key Point**: Both button click and keyboard shortcut call the **same** `handleSubmit()` function, so state transitions are identical.

## Data Flow

### Current Flow (Button Click)

```
User types in textarea
  ↓
User clicks Save/Comment button
  ↓
onClick handler → handleSubmit()
  ↓
Validation
  ↓
API call (if valid)
  ↓
Success/Error handling
```

### New Flow (Keyboard Shortcut)

```
User types in textarea
  ↓
User presses Cmd/Ctrl+Enter
  ↓
onKeyDown handler → detect modifier+Enter → preventDefault() → handleSubmit()
  ↓
Validation (same as button flow)
  ↓
API call (if valid, same as button flow)
  ↓
Success/Error handling (same as button flow)
```

**Difference**: Only the trigger mechanism changes. All subsequent data flow is identical.

## API Integration

**Status**: ❌ NOT APPLICABLE

No API changes. The feature uses existing API endpoints:

- `POST /api/tasks` (TaskForm - existing)
- `PUT /api/tasks/:id` (TaskForm edit - existing)
- `POST /api/memos` (MemoForm - existing)
- `POST /api/tasks/:id/comments` (CommentSection - existing)
- `POST /api/memos/:id/comments` (CommentSection - existing)

## Performance Implications

**Reads**: None (no database queries)
**Writes**: None (no new database writes)
**Cache**: None (no caching layer affected)
**Network**: None (same API calls as before)

**Conclusion**: Zero performance impact on data layer.

## Migration Requirements

**Status**: ❌ NOT APPLICABLE

No database migrations required. No data transformations required.

## Backward Compatibility

**Status**: ✅ FULLY COMPATIBLE

- Old behavior (clicking Save/Comment) still works
- New behavior (keyboard shortcut) is additive only
- No breaking changes to any component props or APIs
- No changes to existing data structures

## Testing Data Requirements

For integration tests, use existing test data patterns:

**TaskForm Tests** (existing patterns):
```tsx
const mockTask = {
  id: '123',
  title: 'Test task',
  body: 'Test body',
  status: 'todo'
};
```

**MemoForm Tests** (existing patterns):
```tsx
const mockMemo = {
  id: '456',
  body: 'Test memo content'
};
```

**No new test data structures required.**

## Summary

This feature requires **zero data model changes**:

- ✅ No database tables modified
- ✅ No API endpoints modified
- ✅ No new entities created
- ✅ No state management changes (uses existing component state)
- ✅ No validation changes (reuses existing rules)
- ✅ No migrations required
- ✅ 100% backward compatible

The implementation is purely **UI event handling** and **user interaction** logic.
