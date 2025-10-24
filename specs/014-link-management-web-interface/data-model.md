# Data Model: Link Management Web Interface

**Feature**: Link Management Web UI
**Branch**: `014-link-management-web-interface`
**Date**: 2025-10-24

## Overview

This document defines the data structures, type definitions, and component architecture for the Link Management Web Interface feature. It serves as the contract between frontend components and backend API endpoints.

---

## UI State Models

These TypeScript interfaces define the state managed within React components for link management.

### LinkDisplayItem

Represents a link as displayed in the UI, with complete information about the target issue.

```typescript
interface LinkDisplayItem {
  /** Unique link ID from database */
  id: number;

  /** Source issue ID (the issue being viewed) */
  sourceIssueId: number;

  /** Target issue ID (the linked issue) */
  targetIssueId: number;

  /** Type of relationship */
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';

  /** Direction relative to the viewed issue */
  direction: 'outgoing' | 'incoming';

  /** Target issue information (populated by API) */
  targetIssue: {
    /** Target issue ID */
    id: number;

    /** Target issue type */
    type: 'task' | 'memo';

    /** Target issue title (or preview text for memos) */
    title: string;
  };

  /** Link creation timestamp */
  createdAt: string;
}
```

**Usage**: This is the primary model for rendering links in the LinkItem component. The `targetIssue` object eliminates the need for additional API calls to fetch target issue details.

**Notes**:
- For memos, `targetIssue.title` contains a preview of the body text (first line)
- For deleted issues, `targetIssue.title` may be "Issue #X (deleted)"
- The `direction` field determines icon rendering and label text

---

### LinkCreationState

Tracks the state of the inline link creation form.

```typescript
interface LinkCreationState {
  /** Whether the add link form is visible */
  isAdding: boolean;

  /** Selected link type (null until user selects) */
  selectedType: 'parent' | 'child' | 'relates' | 'derived_from' | null;

  /** User-entered target issue ID (as string for input binding) */
  targetId: string;

  /** API validation error message (null when no error) */
  error: string | null;

  /** Whether the create API call is in progress */
  isSubmitting: boolean;
}
```

**Usage**: Managed in the LinkSection component to control the multi-step inline form flow.

**State Transitions**:
1. **Idle**: `isAdding: false`
2. **Type Selection**: `isAdding: true, selectedType: null`
3. **ID Entry**: `isAdding: true, selectedType: 'parent'` (example)
4. **Submitting**: `isSubmitting: true`
5. **Error**: `error: 'Issue not found'`
6. **Success**: Reset to Idle

---

### DeleteConfirmationState

Tracks which link is being deleted and confirmation status.

```typescript
interface DeleteConfirmationState {
  /** Link ID pending deletion (null when no deletion in progress) */
  linkId: number | null;

  /** Whether the delete API call is in progress */
  isConfirming: boolean;
}
```

**Usage**: Managed in the LinkItem component to show inline confirmation UI.

**State Transitions**:
1. **Idle**: `linkId: null, isConfirming: false`
2. **Confirmation Prompt**: `linkId: 5, isConfirming: false`
3. **Deleting**: `linkId: 5, isConfirming: true`
4. **Success/Cancel**: Reset to Idle

---

## API Response Types

These types correspond to the OpenAPI-generated types from the API client.

### GET /api/issues/:id/links Response

Returns an array of links with direction and target issue information.

```typescript
type GetIssueLinksResponse = Array<{
  /** Unique link ID */
  id: number;

  /** Source issue ID */
  sourceIssueId: number;

  /** Target issue ID */
  targetIssueId: number;

  /** Link type */
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';

  /** Creation timestamp */
  createdAt: string;

  /** Direction relative to queried issue */
  direction: 'outgoing' | 'incoming';

  /** Target issue information (added in PR #42) */
  targetIssue: {
    id: number;
    type: 'task' | 'memo';
    title: string;
  };
}>;
```

**API Endpoint**: `GET /api/issues/{id}/links`
**Service Method**: `LinksService.listIssueLinks(id: string)`

**Example Response**:
```json
[
  {
    "id": 12,
    "sourceIssueId": 3,
    "targetIssueId": 5,
    "linkType": "parent",
    "direction": "outgoing",
    "targetIssue": {
      "id": 5,
      "type": "task",
      "title": "Implement authentication"
    },
    "createdAt": "2025-10-24T10:30:00Z"
  }
]
```

---

### POST /api/links Request/Response

**Request Body**:
```typescript
interface CreateLinkRequest {
  /** Source issue ID (the issue being viewed) */
  sourceIssueId: number;

  /** Target issue ID (the issue to link to) */
  targetIssueId: number;

  /** Type of relationship */
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';
}
```

**Response Body** (201 Created):
```typescript
interface CreateLinkResponse {
  /** Unique link ID */
  id: number;

  /** Source issue ID */
  sourceIssueId: number;

  /** Target issue ID */
  targetIssueId: number;

  /** Link type */
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';

  /** Creation timestamp */
  createdAt: string;
}
```

**API Endpoint**: `POST /api/links`
**Service Method**: `LinksService.createLink(requestBody: CreateLinkRequest)`

**Error Responses**:
- **400 Bad Request**: Validation error (e.g., circular hierarchy, duplicate link)
  ```json
  {
    "error": "ValidationError",
    "message": "Cannot create link: This would create a circular hierarchy"
  }
  ```
- **404 Not Found**: Target issue does not exist
  ```json
  {
    "error": "NotFoundError",
    "message": "Issue not found"
  }
  ```

---

### DELETE /api/links/:id Response

**Response**: `204 No Content` (empty body on success)

**API Endpoint**: `DELETE /api/links/{id}`
**Service Method**: `LinksService.deleteLink(id: string)`

**Error Responses**:
- **404 Not Found**: Link does not exist
  ```json
  {
    "error": "NotFoundError",
    "message": "Link not found"
  }
  ```

---

## State Transitions

### Link Creation Flow

```
[Idle State]
  isAdding: false
  selectedType: null
  targetId: ""
  error: null
  isSubmitting: false
          |
          | User clicks [+ Add]
          v
[Type Selection]
  isAdding: true
  selectedType: null
  targetId: ""
  error: null
  isSubmitting: false
          |
          | User selects link type (e.g., "parent")
          v
[ID Entry]
  isAdding: true
  selectedType: "parent"
  targetId: ""
  error: null
  isSubmitting: false
          |
          | User enters target ID and clicks [Add]
          v
[Submitting]
  isAdding: true
  selectedType: "parent"
  targetId: "5"
  error: null
  isSubmitting: true
          |
          +---> [API Success] ---> Refresh links list ---> [Idle State]
          |
          +---> [API Error] ---> [Error State]
                                  isAdding: true
                                  selectedType: "parent"
                                  targetId: "5"
                                  error: "Issue not found"
                                  isSubmitting: false
                                       |
                                       | User clicks [Cancel] or retries
                                       v
                                  [Idle State] or [ID Entry]
```

**Cancel Action**: From any state except Submitting, clicking [Cancel] returns to Idle State immediately.

---

### Link Deletion Flow

```
[Idle State]
  linkId: null
  isConfirming: false
          |
          | User clicks [×] next to link
          v
[Confirmation Prompt]
  linkId: 5 (example)
  isConfirming: false
  (UI shows "Delete this link? [Confirm] [Cancel]")
          |
          +---> User clicks [Cancel] ---> [Idle State]
          |
          | User clicks [Confirm]
          v
[Deleting]
  linkId: 5
  isConfirming: true
          |
          +---> [API Success] ---> Remove link from list ---> [Idle State]
          |
          +---> [API Error] ---> Show error message ---> [Idle State]
```

---

## Component Architecture

### LinkSection Component

**File**: `packages/web/src/components/LinkSection.tsx`

**Responsibilities**:
- Fetch links for a given issue via `GET /api/issues/:id/links`
- Manage link creation form state (isAdding, selectedType, targetId)
- Orchestrate link creation via `POST /api/links`
- Render list of LinkItem children
- Manage collapsible section state (expanded/collapsed)

**Props Interface**:
```typescript
interface LinkSectionProps {
  /** Issue ID to fetch links for */
  issueId: number;

  /** Issue type (for context, not strictly required for API calls) */
  issueType: 'memo' | 'task';
}
```

**State**:
```typescript
const [links, setLinks] = useState<LinkDisplayItem[]>([]);
const [loading, setLoading] = useState(true);
const [isExpanded, setIsExpanded] = useState(true);
const [creationState, setCreationState] = useState<LinkCreationState>({
  isAdding: false,
  selectedType: null,
  targetId: '',
  error: null,
  isSubmitting: false,
});
```

**Key Methods**:
- `fetchLinks()`: Calls `LinksService.listIssueLinks()`
- `handleAddLink(targetId: number, linkType: string)`: Calls `LinksService.createLink()`
- `handleDeleteLink(linkId: number)`: Passed to LinkItem as callback
- `handleCancelAdd()`: Resets creation state

**Integration Point**: Rendered in `ItemDetail.tsx` between Labels section and Body section.

---

### LinkItem Component

**File**: `packages/web/src/components/LinkItem.tsx`

**Responsibilities**:
- Display a single link with icon, direction, and target issue title
- Manage local delete confirmation state
- Render delete button and confirmation UI

**Props Interface**:
```typescript
interface LinkItemProps {
  /** Link data to display */
  link: LinkDisplayItem;

  /** Callback when link is successfully deleted */
  onDelete: (linkId: number) => void;
}
```

**State**:
```typescript
const [deleteState, setDeleteState] = useState<DeleteConfirmationState>({
  linkId: null,
  isConfirming: false,
});
```

**Key Methods**:
- `handleDeleteClick()`: Sets `deleteState.linkId` to show confirmation
- `handleConfirmDelete()`: Calls `LinksService.deleteLink()`, then `onDelete()`
- `handleCancelDelete()`: Resets `deleteState`

**Rendering Logic**:
- Show link icon based on `link.linkType` and `link.direction`
- Show target issue title with link to issue detail page
- Show [×] button when not in delete confirmation state
- Show [Confirm] [Cancel] buttons when in confirmation state

---

### AddLinkInline Component

**File**: `packages/web/src/components/AddLinkInline.tsx`

**Responsibilities**:
- Render multi-step inline form (type selection → ID entry)
- Validate user input (non-empty ID, numeric)
- Display API error messages inline

**Props Interface**:
```typescript
interface AddLinkInlineProps {
  /** Source issue ID (the issue being viewed) */
  sourceIssueId: number;

  /** Callback when user successfully submits the form */
  onAdd: (targetId: number, linkType: string) => Promise<void>;

  /** Callback when user cancels the form */
  onCancel: () => void;

  /** Current creation state (managed by parent) */
  creationState: LinkCreationState;

  /** Callback to update creation state */
  setCreationState: (state: LinkCreationState) => void;
}
```

**Rendering Logic**:
- If `creationState.selectedType === null`: Show type selection buttons
- If `creationState.selectedType !== null`: Show ID input field + [Add] [Cancel]
- If `creationState.error`: Show error message below input
- If `creationState.isSubmitting`: Disable inputs and show loading state

**Validation**:
- Client-side: Ensure `targetId` is non-empty and numeric before calling `onAdd`
- Server-side: Display error messages from API response

---

## Data Flow Summary

1. **Initial Load**: `ItemDetail` renders `LinkSection` with `issueId` prop
2. **Fetch Links**: `LinkSection` calls `LinksService.listIssueLinks()` on mount
3. **Display Links**: `LinkSection` maps `links` array to `LinkItem` components
4. **Create Link**: User interaction → `AddLinkInline` → `LinkSection.handleAddLink()` → `LinksService.createLink()` → Re-fetch links
5. **Delete Link**: User clicks [×] → `LinkItem` confirmation → `LinkItem.handleConfirmDelete()` → `LinksService.deleteLink()` → Call `onDelete` callback → `LinkSection` removes from state

---

## Type Mapping: API to UI

The `targetIssue` field from the API response directly maps to the UI state model:

```typescript
// API Response (from GET /api/issues/:id/links)
{
  id: 12,
  sourceIssueId: 3,
  targetIssueId: 5,
  linkType: "parent",
  direction: "outgoing",
  targetIssue: {          // <-- Added in PR #42
    id: 5,
    type: "task",
    title: "Implement authentication"
  },
  createdAt: "2025-10-24T10:30:00Z"
}

// Maps directly to LinkDisplayItem
const displayItem: LinkDisplayItem = {
  id: response.id,
  sourceIssueId: response.sourceIssueId,
  targetIssueId: response.targetIssueId,
  linkType: response.linkType,
  direction: response.direction,
  targetIssue: response.targetIssue,  // No transformation needed
  createdAt: response.createdAt,
};
```

---

## Edge Cases & Error Handling

### Deleted Target Issues

If `targetIssue.title` indicates a deleted issue, the UI should:
- Display grayed-out text: "Issue #5 (deleted)"
- Disable the link (no navigation)
- Still allow deletion of the link

### Long Titles

If `targetIssue.title` exceeds 100 characters:
- Truncate with CSS `text-overflow: ellipsis`
- Show full title on hover with `title` attribute

### Concurrent Modifications

If two users delete the same link:
- First deletion: Success (204 No Content)
- Second deletion: 404 Not Found → Display "Link not found" message inline

### API Timeout

If `GET /api/issues/:id/links` times out:
- Show "Failed to load links. Try again?" with retry button
- Do not block rendering of other sections (Labels, Body)

---

## Summary

This data model establishes clear contracts between:
- **UI components** (LinkSection, LinkItem, AddLinkInline)
- **API endpoints** (GET/POST/DELETE via LinksService)
- **State management** (React useState for local component state)

The inclusion of `targetIssue` in the API response (from PR #42) simplifies the UI implementation by eliminating N+1 queries and providing all necessary display information in a single request.
